import { Request, Response } from "express"
import { getConnection } from "../config/connection"

// This will give the database overview with table names, column counts, and row counts
const getTableDetails = async (req: Request, res: Response) => {
    try {
        const connection = getConnection()

        const [tables] = await connection.execute('SHOW TABLES')
        const tableList = tables as any[]

        const tableDetails = []

        for (const table of tableList) {
            const tableName = Object.values(table)[0] as string;
            console.log("Table name", tableName);

            try {
                // Get column count
                const [structure] = await connection.execute(`DESCRIBE \`${tableName}\``);
                console.log("Structure", structure);
                const columnCount = (structure as any[]).length;
                console.log("Column count", columnCount);

                // Get row count
                const [countResult] = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
                console.log("Row count result", countResult);
                const rowCount = (countResult as any[])[0].count;
                console.log("Row count", rowCount);

                tableDetails.push({
                    tableName: tableName,
                    columns: columnCount,
                    rows: rowCount,
                    status: 'OK'
                });
            } catch (error) {
                tableDetails.push({
                    tableName: tableName,
                    columns: 'Error',
                    rows: 'Error',
                    status: 'Error',
                    error: error
                });
            }
        }

        res.json({
            success: true,
            message: 'Database tables retrieved successfully',
            data: {
                totalTables: tableList.length,
                tables: tableDetails
            }
        });

    } catch (error) {
        console.error("Something went wrong", error);
        res.status(500).json({
            success: false,
            message: "Error fetching table details",
            error: error
        });
    }
}

// Get specific table structure and data with pagination
const getTableData = async (req: Request, res: Response) => {
    try {
        const { tableName } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        if (!tableName) {
            return res.status(400).json({
                success: false,
                message: "Table name is required"
            });
        }

        const connection = getConnection()

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
        console.log(`Getting structure for table: ${tableName}`, structure);

        // Get total count
        const [countResult] = await connection.execute(`SELECT COUNT(*) as total FROM \`${tableName}\``);
        const totalRows = (countResult as any[])[0].total;
        console.log(`Total rows in ${tableName}:`, totalRows);

        // Get data with pagination
        const [data] = await connection.execute(`SELECT * FROM \`${tableName}\` LIMIT ${limit} OFFSET ${offset}`);
        const records = data as any[];
        console.log(`Retrieved ${records.length} records from ${tableName}`);

        res.json({
            success: true,
            message: `Table data for '${tableName}' retrieved successfully`,
            data: {
                tableName: tableName,
                structure: structure,
                records: records,
                pagination: {
                    limit: limit,
                    offset: offset,
                    total: totalRows,
                    hasMore: (offset + limit) < totalRows,
                    currentPage: Math.floor(offset / limit) + 1,
                    totalPages: Math.ceil(totalRows / limit)
                }
            }
        });

    } catch (error) {
        console.error("Error fetching table data:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching table data",
            error: error
        });
    }
}

// Get all tables with sample data
const getAllTableData = async (req: Request, res: Response) => {
    try {
        const connection = getConnection()
        const limit = parseInt(req.query.limit as string) || 5;

        // Get all tables
        const [tables] = await connection.execute('SHOW TABLES');
        const tableList = tables as any[];

        const allTableData = [];

        for (const table of tableList) {
            const tableName = Object.values(table)[0] as string;
            console.log(`Processing table: ${tableName}`);

            try {
                // Get table structure
                const [structure] = await connection.execute(`DESCRIBE \`${tableName}\``);

                // Get row count
                const [countResult] = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
                const rowCount = (countResult as any[])[0].count;

                // Get sample data
                const [sampleData] = await connection.execute(`SELECT * FROM \`${tableName}\` LIMIT ${limit}`);

                allTableData.push({
                    tableName: tableName,
                    structure: structure,
                    rowCount: rowCount,
                    sampleData: sampleData,
                    status: 'OK'
                });

            } catch (error) {
                console.error(`Error processing table ${tableName}:`, error);
                allTableData.push({
                    tableName: tableName,
                    structure: null,
                    rowCount: 'Error',
                    sampleData: null,
                    status: 'Error',
                    error: error
                });
            }
        }

        res.json({
            success: true,
            message: 'All table data retrieved successfully',
            data: {
                totalTables: tableList.length,
                sampleLimit: limit,
                tables: allTableData
            }
        });

    } catch (error) {
        console.error("Error fetching all table data:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching all table data",
            error: error
        });
    }
}

// Get the table data
const getTableRecords = async (req: Request, res: Response) => {
    try {
        const connection = getConnection()
        const { tableName } = req.params;

        if (!tableName) {
            return res.status(400).json({
                success: false,
                message: "Table name is required"
            });
        }

        // get all table records
        const [tables] = await connection.execute('SHOW TABLES');
        const tableList = tables as any[];

        const allTableData = [];
        const [tableRecord] = await connection.execute(`SELECT * FROM \`${tableName}\``);
        allTableData.push({
            tableName: tableName,
            records: tableRecord
        });

        res.json({
            success: true,
            message: "All table records retrieved successfully",
            data: allTableData
        });
    } catch (error) {
        console.error("Error fetching all table records:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching all table records",
            error: error
        });
    }
}

export { getTableDetails, getTableData, getAllTableData, getTableRecords }