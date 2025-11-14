// Helper function to create embeddings table
async function createEmbeddingsTable(connection: any) {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS vector_embeddings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                table_name VARCHAR(255) NOT NULL,
                row_id VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                embedding JSON NOT NULL,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_table_row (table_name, row_id),
                INDEX idx_table_name (table_name)
            )
        `;

        await connection.execute(createTableQuery);
        console.log('Vector embeddings table created or already exists');
    } catch (error) {
        console.error('Error creating embeddings table:', error);
        throw error;
    }
}

// Helper function to add embeddings column to a table
async function addEmbeddingsColumnToTable(connection: any, tableName: string) {
    try {
        // Check if embeddings column already exists
        const [columns] = await connection.execute(`DESCRIBE \`${tableName}\``);
        const hasEmbeddingsColumn = (columns as any[]).some(col => col.Field === 'embeddings');

        if (!hasEmbeddingsColumn) {
            await connection.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN embeddings JSON`);
            console.log(`Added 'embeddings' column to table '${tableName}'`);
        } else {
            console.log(`Table '${tableName}' already has 'embeddings' column`);
        }
    } catch (error) {
        console.error(`Error adding embeddings column to table ${tableName}:`, error);
        throw error;
    }
}

// Helper function to store embedding in the vector_embeddings table
async function storeEmbeddingInTable(connection: any, embeddingData: any): Promise<number> {
    try {
        const insertQuery = `
            INSERT INTO vector_embeddings (table_name, row_id, content, embedding, metadata)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            content = VALUES(content),
            embedding = VALUES(embedding),
            metadata = VALUES(metadata),
            updated_at = CURRENT_TIMESTAMP
        `;

        const [result] = await connection.execute(insertQuery, [
            embeddingData.tableName,
            embeddingData.rowId.toString(),
            embeddingData.content,
            JSON.stringify(embeddingData.embedding),
            JSON.stringify(embeddingData.metadata)
        ]);

        const insertId = (result as any).insertId || (result as any).affectedRows;
        console.log(`Stored embedding for ${embeddingData.tableName} row ${embeddingData.rowId} in vector_embeddings table`);

        return insertId;
    } catch (error) {
        console.error('Error storing embedding in table:', error);
        throw error;
    }
}

export {
    storeEmbeddingInTable,
    addEmbeddingsColumnToTable,
    createEmbeddingsTable
}