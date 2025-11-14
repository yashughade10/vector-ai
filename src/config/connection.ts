import mysql from 'mysql2/promise';

let connection: mysql.Connection | null = null;

const connectDB = async () => {
    try {
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'goocampus_db',
            port: 3306
        });

        console.log('Connected to MySQL database successfully');
        console.log(`Connected to: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'}`);

        return connection;
    } catch (error) {
        console.log("MySQL connection failed:", error);
        throw error;
    }
}

// Function to get database connection
const getConnection = () => {
    if (!connection) {
        throw new Error('Database connection not established. Call connectDB() first.');
    }
    return connection;
}

// Function to close database connection
const closeConnection = async () => {
    if (connection) {
        await connection.end();
        connection = null;
        console.log('MySQL connection closed');
    }
}

// Function to get all tables in the database
const getTables = async () => {
    try {
        const conn = getConnection();
        const [rows] = await conn.execute('SHOW TABLES');
        console.log('Database tables:', rows);
        return rows;
    } catch (error) {
        console.log('Error fetching tables:', error);
        throw error;
    }
}

// Function to describe a specific table
const describeTable = async (tableName: string) => {
    try {
        const conn = getConnection();
        const [rows] = await conn.execute(`DESCRIBE ${tableName}`);
        console.log(`Table structure for ${tableName}:`, rows);
        return rows;
    } catch (error) {
        console.log(`Error describing table ${tableName}:`, error);
        throw error;
    }
}

// Function to get database information
const getDatabaseInfo = async () => {
    try {
        const conn = getConnection();
        const [dbInfo] = await conn.execute('SELECT DATABASE() as current_database');
        const [version] = await conn.execute('SELECT VERSION() as mysql_version');
        const tables = await getTables();

        const info = {
            currentDatabase: dbInfo,
            mysqlVersion: version,
            tables: tables
        };

        console.log('Database Information:', info);
        return info;
    } catch (error) {
        console.log('Error fetching database info:', error);
        throw error;
    }
}

export {
    connectDB,
    getConnection,
    closeConnection,
    getTables,
    describeTable,
    getDatabaseInfo
}