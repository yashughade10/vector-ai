import { Request, Response } from "express";
import { getConnection } from "../config/connection";
import { storeEmbeddingInTable, addEmbeddingsColumnToTable, createEmbeddingsTable } from "../utils/embedding.utils";
import OpenAI from 'openai';

// Function to get OpenAI instance (lazy initialization)
const getOpenAI = () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
    }
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
};

// Generate embeddings for specific table rows
const generateTableRowEmbeddings = async (req: Request, res: Response) => {
    try {
        const { tableName } = req.params;
        const offset = parseInt(req.query.offset as string) || 0;

        if (!tableName) {
            return res.status(400).json({
                success: false,
                message: "Table name is required"
            });
        }

        const connection = getConnection();

        // Check if table exists
        const [tables] = await connection.execute('SHOW TABLES');
        const tableList = tables as any[];
        const tableExists = tableList.some(table =>
            Object.values(table)[0] === tableName
        );

        if (!tableExists) {
            return res.status(404).json({
                success: false,
                message: `Table '${tableName}' does not exist`
            });
        }

        // Create embeddings table if it doesn't exist
        await createEmbeddingsTable(connection);

        // Add embeddings column to the original table if it doesn't exist
        await addEmbeddingsColumnToTable(connection, tableName);

        // Get table structure
        const [structure] = await connection.execute(`DESCRIBE \`${tableName}\``);
        const columns = structure as any[];

        // Find primary key column
        const primaryKeyColumn = columns.find(col => col.Key === 'PRI');
        if (!primaryKeyColumn) {
            return res.status(400).json({
                success: false,
                message: `Table '${tableName}' must have a primary key to generate embeddings`
            });
        }

        // Get rows data
        const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
        const rowsData = rows as any[];

        if (rowsData.length === 0) {
            return res.json({
                success: true,
                message: `No data found in table '${tableName}'`,
                data: {
                    tableName: tableName,
                    embeddings: [],
                    totalProcessed: 0
                }
            });
        }

        const embeddings = [];
        const openai = getOpenAI();

        console.log(`Generating embeddings for ${rowsData.length} rows from table: ${tableName}`);

        for (let i = 0; i < rowsData.length; i++) {
            const row = rowsData[i];
            const primaryKeyValue = row[primaryKeyColumn.Field];

            try {
                // Create meaningful content for each row
                const rowContent = createRowContent(tableName, columns, row, i + offset);

                console.log(`Processing row ${i + 1}/${rowsData.length} for table ${tableName} (ID: ${primaryKeyValue})`);

                // Generate embedding for this row
                const embeddingResponse = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: rowContent,
                    encoding_format: 'float'
                });

                const embedding = embeddingResponse.data[0].embedding;
                const embeddingJson = JSON.stringify(embedding);

                // Store embedding in the embeddings table
                const embeddingId = await storeEmbeddingInTable(connection, {
                    tableName: tableName,
                    rowId: primaryKeyValue,
                    content: rowContent,
                    embedding: embedding,
                    metadata: {
                        databaseName: process.env.MYSQL_DATABASE || "test_db",
                        tableName: tableName,
                        rowIndex: i + offset,
                        primaryKeyColumn: primaryKeyColumn.Field,
                        primaryKeyValue: primaryKeyValue,
                        description: `Row data from table ${tableName}`
                    }
                });

                // Update the original table with the embedding
                await connection.execute(
                    `UPDATE \`${tableName}\` SET embeddings = ? WHERE \`${primaryKeyColumn.Field}\` = ?`,
                    [embeddingJson, primaryKeyValue]
                );

                // Create formatted response for each row
                const rowEmbedding = {
                    embeddingId: embeddingId,
                    content: rowContent,
                    embedding: embedding,
                    metadata: {
                        databaseName: process.env.MYSQL_DATABASE || "test_db",
                        tableName: tableName,
                        rowIndex: i + offset,
                        primaryKey: primaryKeyValue,
                        description: `Row data from table ${tableName}`,
                        storedInTable: true,
                        storedInEmbeddingsTable: true
                    },
                    createdAt: Date.now().toString(),
                    updatedAt: Date.now().toString()
                };

                embeddings.push(rowEmbedding);

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 150));

            } catch (error) {
                console.error(`Error processing row ${i + 1} in table ${tableName}:`, error);
                embeddings.push({
                    tableName: tableName,
                    rowIndex: i + offset,
                    primaryKey: primaryKeyValue,
                    error: error,
                    status: "failed"
                });
            }
        }

        res.json({
            success: true,
            message: `Generated embeddings for ${rowsData.length} rows from table '${tableName}' and stored in both original table and embeddings table`,
            data: {
                tableName: tableName,
                totalProcessed: rowsData.length,
                successfulEmbeddings: embeddings.filter(e => !(e as any).error).length,
                failedEmbeddings: embeddings.filter(e => (e as any).error).length,
                storage: {
                    originalTable: `Updated '${tableName}' table with 'embeddings' column`,
                    embeddingsTable: "Stored in 'vector_embeddings' table"
                },
                pagination: {
                    offset: offset,
                    processedRows: rowsData.length
                },
                embeddings: embeddings
            }
        });

    } catch (error) {
        console.error("Error generating row embeddings:", error);
        res.status(500).json({
            success: false,
            message: "Error generating row embeddings",
            error: error
        });
    }
};

const generateTableEmbedding = async (req: Request, res: Response) => {
    try {
        const { tableName } = req.params;

        if (!tableName) {
            return res.status(400).json({
                success: false,
                message: "Table name is required"
            });
        }

        const connection = getConnection();

        // Check if table exists
        const [tables] = await connection.execute('SHOW TABLES');
        const tableList = tables as any[];
        const tableExists = tableList.some(table =>
            Object.values(table)[0] === tableName
        );

        if (!tableExists) {
            return res.status(404).json({
                success: false,
                message: `Table '${tableName}' does not exist`
            });
        }

        // Get table structure
        const [structure] = await connection.execute(`DESCRIBE \`${tableName}\``);
        const columns = structure as any[];

        // Get row count
        const [countResult] = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        const rowCount = (countResult as any[])[0].count;

        // Build content string for embedding
        const columnsDescription = columns.map(col => {
            const extras = [];
            if (col.Key === 'PRI') extras.push('PRIMARY KEY');
            if (col.Key === 'UNI') extras.push('UNIQUE');
            if (col.Key === 'MUL') extras.push('INDEX');
            if (col.Extra) extras.push(col.Extra);

            return `${col.Field} (${col.Type}${extras.length ? ', ' + extras.join(', ') : ''})`;
        }).join(', ');

        const content = `Table: ${tableName}\nColumns: ${columnsDescription}\nRow Count: ${rowCount}\nDescription: Database table containing ${columns.length} columns with ${rowCount} records.`;

        console.log(`Generating embedding for table: ${tableName}`);
        console.log(`Content: ${content}`);

        // Get OpenAI instance and generate embedding
        const openai = getOpenAI();
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: content,
            encoding_format: 'float'
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Create response in the format you specified
        const response = {
            content: content,
            embedding: embedding.map((val: number) => ({ $numberDouble: val.toString() })),
            metadata: {
                databaseName: process.env.MYSQL_DATABASE || "test_db",
                tableName: tableName,
                recordCount: { $numberInt: rowCount.toString() },
                description: `Table ${tableName} with ${columns.length} columns`,
            },
            createdAt: Date.now().toString(),
            updatedAt: Date.now().toString()
        };

        res.json({
            success: true,
            message: `Vector embedding generated for table '${tableName}'`,
            data: response
        });

    } catch (error) {
        console.error("Error generating table embedding:", error);
        res.status(500).json({
            success: false,
            message: "Error generating table embedding",
            error: error
        });
    }
};

// Helper function to create meaningful content from row data
function createRowContent(tableName: string, columns: any[], row: any, rowIndex: number): string {
    const rowData = columns.map(col => {
        const value = row[col.Field];
        if (value === null || value === undefined) {
            return `${col.Field}: null`;
        }
        if (typeof value === 'string' && value.length > 100) {
            return `${col.Field}: ${value.substring(0, 100)}...`;
        }
        return `${col.Field}: ${value}`;
    }).join(', ');

    return `Table: ${tableName}, Row ${rowIndex + 1}\nData: ${rowData}\nDescription: Record from ${tableName} table containing information about ${getRowDescription(tableName, row)}.`;
}

// Function to create a meaningful description based on table name and data
function getRowDescription(tableName: string, row: any): string {
    // Try to find common descriptive fields
    const nameFields = ['name', 'title', 'username', 'email', 'description'];

    for (const field of nameFields) {
        if (row[field]) {
            return row[field];
        }
    }

    // If no descriptive field found, use table name
    return `${tableName} record`;
}

// Get embeddings for a specific table
const getTableEmbeddings = async (req: Request, res: Response) => {
    try {
        const { tableName } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const connection = getConnection();

        // Get embeddings from vector_embeddings table
        const [embeddings] = await connection.execute(
            `SELECT * FROM vector_embeddings WHERE table_name = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [tableName, limit, offset]
        );

        // Get total count
        const [countResult] = await connection.execute(
            `SELECT COUNT(*) as total FROM vector_embeddings WHERE table_name = ?`,
            [tableName]
        );

        const total = (countResult as any[])[0].total;

        res.json({
            success: true,
            message: `Retrieved ${(embeddings as any[]).length} embeddings for table '${tableName}'`,
            data: {
                tableName: tableName,
                embeddings: embeddings,
                pagination: {
                    limit: limit,
                    offset: offset,
                    total: total,
                    hasMore: (offset + limit) < total
                }
            }
        });

    } catch (error) {
        console.error("Error retrieving table embeddings:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving table embeddings",
            error: error
        });
    }
};

// Get all embeddings from all tables
const getAllEmbeddings = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        const connection = getConnection();

        // Get all embeddings
        const [embeddings] = await connection.execute(
            `SELECT * FROM vector_embeddings ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        // Get total count
        const [countResult] = await connection.execute(
            `SELECT COUNT(*) as total FROM vector_embeddings`
        );

        // Get count by table
        const [tableStats] = await connection.execute(
            `SELECT table_name, COUNT(*) as count FROM vector_embeddings GROUP BY table_name`
        );

        const total = (countResult as any[])[0].total;

        res.json({
            success: true,
            message: `Retrieved ${(embeddings as any[]).length} embeddings from all tables`,
            data: {
                embeddings: embeddings,
                statistics: {
                    totalEmbeddings: total,
                    byTable: tableStats
                },
                pagination: {
                    limit: limit,
                    offset: offset,
                    total: total,
                    hasMore: (offset + limit) < total
                }
            }
        });

    } catch (error) {
        console.error("Error retrieving all embeddings:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving all embeddings",
            error: error
        });
    }
};


// Utility function to generate MongoDB-like ObjectIds
function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const randomPart = Math.random().toString(16).substr(2, 16);
    return timestamp + randomPart.padStart(16, '0').substr(0, 16);
}

export {
    generateTableEmbedding,
    generateTableRowEmbeddings,
    getTableEmbeddings,
    getAllEmbeddings
};