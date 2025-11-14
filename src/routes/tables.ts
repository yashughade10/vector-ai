import { Router } from 'express';
import { getTableDetails, getTableData, getAllTableData, getTableRecords } from '../controllers/tabledetails.controller';
import { generateTableEmbedding, generateTableRowEmbeddings, getTableEmbeddings, getAllEmbeddings } from '../controllers/embeddings.controller';

const router = Router();

// Get all tables overview
router.get('/tables', getTableDetails);

// Get all tables with sample data
router.get('/tables/data', getAllTableData);

// Get specific table structure
router.get('/table/:tableName', getTableData);

// Get specific table data
router.get('/table/:tableName/data', getTableRecords);

// Generate embedding for specific table schema
router.post('/table/:tableName/embedding', generateTableEmbedding);

// Generate embeddings for specific table rows
router.post('/table/:tableName/rows/embeddings', generateTableRowEmbeddings);

// Get embeddings for specific table
router.get('/table/:tableName/embeddings', getTableEmbeddings);

// Get all embeddings from all tables
router.get('/embeddings', getAllEmbeddings);

export default router;