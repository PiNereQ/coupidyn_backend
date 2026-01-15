import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 20,  // Increased from 10 to handle more concurrent queries
  queueLimit: 0
});

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Successfully connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Error connecting to MySQL database:', err.message);
    console.error('Database config:', {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
  });

// Handle pool connection errors
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('Database connection was closed.');
  }
  if (err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
    console.error('Fatal error occurred, new connections cannot be created at this time.');
  }
  if (err.code === 'PROTOCOL_ENQUEUE_AFTER_PARSER_DESTROYED') {
    console.error('Connection was destroyed by the server.');
  }
});

export default pool;