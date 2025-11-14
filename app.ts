import express from "express"
import databaseRoutes from "./src/routes/tables"

const app = express()

// Accepting the json
app.use(express.json({ limit: "20kb" }))

// Encoding the url configuration
app.use(express.urlencoded({ extended: true, limit: "20kb" }))

// It will store file/folder in public assets/folders
app.use(express.static("public"))

// Database routes
app.use('/api/db', databaseRoutes)

// Root route with available endpoints
app.get('/', (req, res) => {
    res.json({
        message: 'Vector AI Backend Server is running!',
        availableEndpoints: {
            'All Tables Overview': 'GET /api/db/tables',
            'All Tables with Sample Data': 'GET /api/db/tables/data',
            'Specific Table Data': 'GET /api/db/table/:tableName/data',
            'Generate Table Schema Embedding': 'POST /api/db/table/:tableName/embedding',
            'Generate All Table Schema Embeddings': 'POST /api/db/tables/embeddings',
            'Generate Table Row Embeddings': 'POST /api/db/table/:tableName/rows/embeddings',
            'Generate All Row Embeddings': 'POST /api/db/tables/rows/embeddings'
        },
        examples: {
            'View all tables': `http://localhost:${process.env.PORT || 4010}/api/db/tables`,
            'View all tables with data': `http://localhost:${process.env.PORT || 4010}/api/db/tables/data`,
            'View users table data': `http://localhost:${process.env.PORT || 4010}/api/db/table/users/data`,
            'View admin table data': `http://localhost:${process.env.PORT || 4010}/api/db/table/admin/data`,
            'Generate table schema embedding': `POST http://localhost:${process.env.PORT || 4010}/api/db/table/users/embedding`,
            'Generate all schema embeddings': `POST http://localhost:${process.env.PORT || 4010}/api/db/tables/embeddings`,
            'Generate row embeddings': `POST http://localhost:${process.env.PORT || 4010}/api/db/table/users/rows/embeddings`,
            'Generate all row embeddings': `POST http://localhost:${process.env.PORT || 4010}/api/db/tables/rows/embeddings`,
            'With pagination': `http://localhost:${process.env.PORT || 4010}/api/db/table/users/data?limit=5&offset=0`
        },
        queryParameters: {
            'limit': 'Number of records to return (default: 10 for single table, 5 for all tables)',
            'offset': 'Number of records to skip (default: 0)'
        }
    })
})

export { app }