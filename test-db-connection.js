const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('Testing MySQL connection...');
  console.log('Host:', process.env.DB_HOST);
  console.log('Port:', process.env.DB_PORT);
  console.log('Database:', process.env.DB_NAME);
  console.log('User:', process.env.DB_USER);
  console.log('Password:', process.env.DB_PASSWORD ? '***' : 'NOT SET');

  try {
    console.log('\n1. Testing basic connection...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });

    console.log('✅ Basic connection successful!');
    
    // Check if database exists (fixed SQL syntax)
    const [databases] = await connection.execute(`SHOW DATABASES LIKE '${process.env.DB_NAME}'`);
    console.log('Database exists:', databases.length > 0 ? 'YES' : 'NO');
    
    if (databases.length === 0) {
      console.log('Creating database...');
      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME_TEST}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log('✅ Databases created!');
    }
    
    await connection.end();
    
    // Now try with database
    console.log('\n2. Testing connection with database...');
    const dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Database connection successful!');
    
    const [rows] = await dbConnection.execute('SELECT 1 as test');
    console.log('✅ Query test successful:', rows);
    
    await dbConnection.end();
    console.log('\n🎉 All tests passed! Your MySQL connection is working.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error errno:', error.errno);
    console.error('SQL State:', error.sqlState);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n🔧 Run this in MySQL/phpMyAdmin:');
      console.log(`ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${process.env.DB_PASSWORD}';`);
      console.log('FLUSH PRIVILEGES;');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n🔧 Database does not exist. Run this in MySQL/phpMyAdmin:');
      console.log(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    }
  }
}

testConnection();