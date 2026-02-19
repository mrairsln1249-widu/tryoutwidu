import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'to_wijaya_edu',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function insert(table, data) {
  const columns = Object.keys(data).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const values = Object.values(data);
  const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
  const [result] = await pool.execute(sql, values);
  return result.insertId;
}

export async function update(table, data, where, whereParams = []) {
  const set = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), ...whereParams];
  const sql = `UPDATE ${table} SET ${set} WHERE ${where}`;
  const [result] = await pool.execute(sql, values);
  return result.affectedRows;
}

export async function remove(table, where, params = []) {
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  const [result] = await pool.execute(sql, params);
  return result.affectedRows;
}

export default pool;
