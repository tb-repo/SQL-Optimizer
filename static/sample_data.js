window.SAMPLE_DATA = {
    postgresql: {
        sql_query: `SELECT 
    c.customer_name,
    COUNT(DISTINCT o.order_id) as order_count,
    SUM(oi.quantity * p.unit_price) as total_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.product_id
WHERE o.order_date >= '2023-01-01'
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(DISTINCT o.order_id) > 5
ORDER BY total_spent DESC
LIMIT 10;`,
        tables: [
            {
                name: "customers",
                ddl: "CREATE TABLE customers (customer_id SERIAL PRIMARY KEY, customer_name VARCHAR(100) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
                rows: "100000",
                has_primary_key: true,
                primary_key_column: "customer_id"
            },
            {
                name: "orders",
                ddl: "CREATE TABLE orders (order_id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(customer_id), order_date TIMESTAMP NOT NULL, status VARCHAR(20) NOT NULL, CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id));",
                rows: "500000",
                has_primary_key: true,
                primary_key_column: "order_id",
                has_foreign_key: true,
                foreign_key_column: "customer_id",
                foreign_key_table: "customers"
            },
            {
                name: "products",
                ddl: "CREATE TABLE products (product_id SERIAL PRIMARY KEY, product_name VARCHAR(200) NOT NULL, unit_price DECIMAL(10,2) NOT NULL, category VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
                rows: "10000",
                has_primary_key: true,
                primary_key_column: "product_id"
            },
            {
                name: "order_items",
                ddl: "CREATE TABLE order_items (order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0), PRIMARY KEY (order_id, product_id), CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(order_id), CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(product_id));",
                rows: "1500000",
                has_primary_key: true,
                primary_key_column: "order_id, product_id",
                has_foreign_key: true,
                foreign_key_column: "order_id",
                foreign_key_table: "orders"
            }
        ],
        indexes: [
            {
                name: "idx_customers_email",
                table: "customers",
                definition: "CREATE UNIQUE INDEX idx_customers_email ON customers(email);"
            },
            {
                name: "idx_orders_customer",
                table: "orders",
                definition: "CREATE INDEX idx_orders_customer ON orders(customer_id);"
            },
            {
                name: "idx_orders_date",
                table: "orders",
                definition: "CREATE INDEX idx_orders_date ON orders(order_date);"
            },
            {
                name: "idx_order_items_product",
                table: "order_items",
                definition: "CREATE INDEX idx_order_items_product ON order_items(product_id);"
            }
        ],
        explain: `Limit  (cost=97517.96..97518.21 rows=10 width=84)
  ->  Sort  (cost=97517.96..97768.96 rows=100400 width=84)
        Sort Key: (sum((oi.quantity * p.unit_price))) DESC
        ->  HashAggregate  (cost=93016.48..94522.48 rows=100400 width=84)
              Group Key: c.customer_id, c.customer_name
              Filter: (count(DISTINCT o.order_id) > 5)
              ->  Hash Join  (cost=15437.00..89515.23 rows=500000 width=84)
                    Hash Cond: (o.customer_id = c.customer_id)
                    ->  Hash Join  (cost=14937.00..87765.23 rows=500000 width=84)
                          Hash Cond: (oi.order_id = o.order_id)
                          ->  Hash Join  (cost=4937.00..75265.23 rows=500000 width=38)
                                Hash Cond: (oi.product_id = p.product_id)
                                ->  Seq Scan on order_items oi  (cost=0.00..45265.23 rows=1500000 width=16)
                                ->  Hash  (cost=3437.00..3437.00 rows=10000 width=22)
                                      ->  Seq Scan on products p  (cost=0.00..3437.00 rows=10000 width=22)
                          ->  Hash  (cost=8750.00..8750.00 rows=100000 width=54)
                                ->  Seq Scan on orders o  (cost=0.00..8750.00 rows=100000 width=54)
                                      Filter: (order_date >= '2023-01-01'::timestamp without time zone)
                    ->  Hash  (cost=250.00..250.00 rows=20000 width=36)
                          ->  Seq Scan on customers c  (cost=0.00..250.00 rows=20000 width=36)`
    },
    mysql: {
        sql_query: `SELECT 
    c.customer_name,
    COUNT(DISTINCT o.order_id) as order_count,
    SUM(oi.quantity * p.unit_price) as total_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.product_id
WHERE o.order_date >= '2023-01-01'
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(DISTINCT o.order_id) > 5
ORDER BY total_spent DESC
LIMIT 10;`,
        tables: [
            {
                name: "customers",
                ddl: "CREATE TABLE customers (customer_id INT AUTO_INCREMENT PRIMARY KEY, customer_name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
                rows: "100000",
                has_primary_key: true,
                primary_key_column: "customer_id"
            },
            {
                name: "orders",
                ddl: "CREATE TABLE orders (order_id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, order_date TIMESTAMP NOT NULL, status VARCHAR(20) NOT NULL, CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id));",
                rows: "500000",
                has_primary_key: true,
                primary_key_column: "order_id",
                has_foreign_key: true,
                foreign_key_column: "customer_id",
                foreign_key_table: "customers"
            },
            {
                name: "products",
                ddl: "CREATE TABLE products (product_id INT AUTO_INCREMENT PRIMARY KEY, product_name VARCHAR(200) NOT NULL, unit_price DECIMAL(10,2) NOT NULL, category VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
                rows: "10000",
                has_primary_key: true,
                primary_key_column: "product_id"
            },
            {
                name: "order_items",
                ddl: "CREATE TABLE order_items (order_id INT NOT NULL, product_id INT NOT NULL, quantity INT NOT NULL CHECK (quantity > 0), PRIMARY KEY (order_id, product_id), CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(order_id), CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(product_id));",
                rows: "1500000",
                has_primary_key: true,
                primary_key_column: "order_id, product_id",
                has_foreign_key: true,
                foreign_key_column: "order_id",
                foreign_key_table: "orders"
            }
        ],
        indexes: [
            {
                name: "idx_customers_email",
                table: "customers",
                definition: "CREATE UNIQUE INDEX idx_customers_email ON customers(email);"
            },
            {
                name: "idx_orders_customer",
                table: "orders",
                definition: "CREATE INDEX idx_orders_customer ON orders(customer_id);"
            },
            {
                name: "idx_orders_date",
                table: "orders",
                definition: "CREATE INDEX idx_orders_date ON orders(order_date);"
            },
            {
                name: "idx_order_items_product",
                table: "order_items",
                definition: "CREATE INDEX idx_order_items_product ON order_items(product_id);"
            }
        ],
        explain: `-> Limit: 10 row(s)  (cost=0.00..0.00 rows=0)
    -> Sort: total_spent DESC  (cost=0.00..0.00 rows=0)
        -> Filter: (count(distinct o.order_id) > 5)  (cost=0.00..0.00 rows=0)
            -> Table scan on <temporary>  (cost=2.50..2.50 rows=0)
                -> Aggregate using temporary table  (cost=0.00..0.00 rows=0)
                    -> Left hash join (c.customer_id = o.customer_id)  (cost=25375.25 rows=250000)
                        -> Table scan on c  (cost=0.03 rows=100000)
                        -> Hash
                            -> Left hash join (o.order_id = oi.order_id)  (cost=25375.25 rows=250000)
                                -> Filter: (o.order_date >= TIMESTAMP'2023-01-01 00:00:00')  (cost=51.25 rows=500000)
                                    -> Table scan on o  (cost=51.25 rows=500000)
                                -> Hash
                                    -> Left hash join (oi.product_id = p.product_id)  (cost=25375.25 rows=250000)
                                        -> Table scan on oi  (cost=152.50 rows=1500000)
                                        -> Hash
                                            -> Table scan on p  (cost=1.03 rows=10000)`
    },
    sqlserver: {
        sql_query: `SELECT 
    c.customer_name,
    COUNT(DISTINCT o.order_id) as order_count,
    SUM(oi.quantity * p.unit_price) as total_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.product_id
WHERE o.order_date >= '2023-01-01'
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(DISTINCT o.order_id) > 5
ORDER BY total_spent DESC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;`,
        tables: [
            {
                name: "customers",
                ddl: "CREATE TABLE customers (customer_id INT IDENTITY(1,1) PRIMARY KEY, customer_name NVARCHAR(100) NOT NULL, email NVARCHAR(255) NOT NULL UNIQUE, created_at DATETIME2 DEFAULT GETDATE());",
                rows: "100000",
                has_primary_key: true,
                primary_key_column: "customer_id"
            },
            {
                name: "orders",
                ddl: "CREATE TABLE orders (order_id INT IDENTITY(1,1) PRIMARY KEY, customer_id INT NOT NULL, order_date DATETIME2 NOT NULL, status NVARCHAR(20) NOT NULL, CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id));",
                rows: "500000",
                has_primary_key: true,
                primary_key_column: "order_id",
                has_foreign_key: true,
                foreign_key_column: "customer_id",
                foreign_key_table: "customers"
            },
            {
                name: "products",
                ddl: "CREATE TABLE products (product_id INT IDENTITY(1,1) PRIMARY KEY, product_name NVARCHAR(200) NOT NULL, unit_price DECIMAL(10,2) NOT NULL, category NVARCHAR(50), created_at DATETIME2 DEFAULT GETDATE());",
                rows: "10000",
                has_primary_key: true,
                primary_key_column: "product_id"
            },
            {
                name: "order_items",
                ddl: "CREATE TABLE order_items (order_id INT NOT NULL, product_id INT NOT NULL, quantity INT NOT NULL CHECK (quantity > 0), PRIMARY KEY (order_id, product_id), CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(order_id), CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(product_id));",
                rows: "1500000",
                has_primary_key: true,
                primary_key_column: "order_id, product_id",
                has_foreign_key: true,
                foreign_key_column: "order_id",
                foreign_key_table: "orders"
            }
        ],
        indexes: [
            {
                name: "idx_customers_email",
                table: "customers",
                definition: "CREATE UNIQUE INDEX idx_customers_email ON customers(email);"
            },
            {
                name: "idx_orders_customer",
                table: "orders",
                definition: "CREATE INDEX idx_orders_customer ON orders(customer_id);"
            },
            {
                name: "idx_orders_date",
                table: "orders",
                definition: "CREATE INDEX idx_orders_date ON orders(order_date);"
            },
            {
                name: "idx_order_items_product",
                table: "order_items",
                definition: "CREATE INDEX idx_order_items_product ON order_items(product_id);"
            }
        ],
        explain: `|--Top N Sort(TOP 10)
    |--Hash Match(Aggregate)
        |--Hash Match(Inner Join, HASH:([c].[customer_id])=([o].[customer_id]))
            |--Table Scan(OBJECT:([customers] AS [c]))
            |--Hash Match(Inner Join, HASH:([o].[order_id])=([oi].[order_id]))
                |--Table Scan(OBJECT:([orders] AS [o]))
                |   |--Predicate:([o].[order_date]>='2023-01-01 00:00:00.000')
                |--Hash Match(Inner Join, HASH:([oi].[product_id])=([p].[product_id]))
                    |--Table Scan(OBJECT:([order_items] AS [oi]))
                    |--Table Scan(OBJECT:([products] AS [p]))`
    },
    oracle: {
        sql_query: `SELECT 
    c.customer_name,
    COUNT(DISTINCT o.order_id) as order_count,
    SUM(oi.quantity * p.unit_price) as total_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.product_id
WHERE o.order_date >= TO_DATE('2023-01-01', 'YYYY-MM-DD')
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(DISTINCT o.order_id) > 5
ORDER BY total_spent DESC
FETCH FIRST 10 ROWS ONLY;`,
        tables: [
            {
                name: "customers",
                ddl: "CREATE TABLE customers (customer_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, customer_name VARCHAR2(100) NOT NULL, email VARCHAR2(255) NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT SYSTIMESTAMP);",
                rows: "100000",
                has_primary_key: true,
                primary_key_column: "customer_id"
            },
            {
                name: "orders",
                ddl: "CREATE TABLE orders (order_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, customer_id NUMBER NOT NULL, order_date TIMESTAMP NOT NULL, status VARCHAR2(20) NOT NULL, CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id));",
                rows: "500000",
                has_primary_key: true,
                primary_key_column: "order_id",
                has_foreign_key: true,
                foreign_key_column: "customer_id",
                foreign_key_table: "customers"
            },
            {
                name: "products",
                ddl: "CREATE TABLE products (product_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, product_name VARCHAR2(200) NOT NULL, unit_price NUMBER(10,2) NOT NULL, category VARCHAR2(50), created_at TIMESTAMP DEFAULT SYSTIMESTAMP);",
                rows: "10000",
                has_primary_key: true,
                primary_key_column: "product_id"
            },
            {
                name: "order_items",
                ddl: "CREATE TABLE order_items (order_id NUMBER NOT NULL, product_id NUMBER NOT NULL, quantity NUMBER NOT NULL CHECK (quantity > 0), PRIMARY KEY (order_id, product_id), CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(order_id), CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(product_id));",
                rows: "1500000",
                has_primary_key: true,
                primary_key_column: "order_id, product_id",
                has_foreign_key: true,
                foreign_key_column: "order_id",
                foreign_key_table: "orders"
            }
        ],
        indexes: [
            {
                name: "idx_customers_email",
                table: "customers",
                definition: "CREATE UNIQUE INDEX idx_customers_email ON customers(email);"
            },
            {
                name: "idx_orders_customer",
                table: "orders",
                definition: "CREATE INDEX idx_orders_customer ON orders(customer_id);"
            },
            {
                name: "idx_orders_date",
                table: "orders",
                definition: "CREATE INDEX idx_orders_date ON orders(order_date);"
            },
            {
                name: "idx_order_items_product",
                table: "order_items",
                definition: "CREATE INDEX idx_order_items_product ON order_items(product_id);"
            }
        ],
        explain: `SELECT STATEMENT  (Cost=97518 Card=10)
  SORT ORDER BY  (Cost=97518 Card=10)
    HASH GROUP BY  (Cost=97517 Card=100400)
      FILTER
        HASH JOIN  (Cost=15437 Card=500000)
          TABLE ACCESS FULL CUSTOMERS  (Cost=250 Card=20000)
          HASH JOIN  (Cost=14937 Card=500000)
            TABLE ACCESS FULL ORDERS  (Cost=8750 Card=100000)
              FILTER: ORDER_DATE>=TO_DATE('2023-01-01')
            HASH JOIN  (Cost=4937 Card=500000)
              TABLE ACCESS FULL ORDER_ITEMS  (Cost=45265 Card=1500000)
              TABLE ACCESS FULL PRODUCTS  (Cost=3437 Card=10000)`
    },
    sqlite: {
        sql_query: `SELECT 
    c.customer_name,
    COUNT(DISTINCT o.order_id) as order_count,
    SUM(oi.quantity * p.unit_price) as total_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.product_id
WHERE o.order_date >= '2023-01-01'
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(DISTINCT o.order_id) > 5
ORDER BY total_spent DESC
LIMIT 10;`,
        tables: [
            {
                name: "customers",
                ddl: "CREATE TABLE customers (customer_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
                rows: "100000",
                has_primary_key: true,
                primary_key_column: "customer_id"
            },
            {
                name: "orders",
                ddl: "CREATE TABLE orders (order_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, order_date TIMESTAMP NOT NULL, status TEXT NOT NULL, FOREIGN KEY (customer_id) REFERENCES customers(customer_id));",
                rows: "500000",
                has_primary_key: true,
                primary_key_column: "order_id",
                has_foreign_key: true,
                foreign_key_column: "customer_id",
                foreign_key_table: "customers"
            },
            {
                name: "products",
                ddl: "CREATE TABLE products (product_id INTEGER PRIMARY KEY AUTOINCREMENT, product_name TEXT NOT NULL, unit_price DECIMAL(10,2) NOT NULL, category TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
                rows: "10000",
                has_primary_key: true,
                primary_key_column: "product_id"
            },
            {
                name: "order_items",
                ddl: "CREATE TABLE order_items (order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0), PRIMARY KEY (order_id, product_id), FOREIGN KEY (order_id) REFERENCES orders(order_id), FOREIGN KEY (product_id) REFERENCES products(product_id));",
                rows: "1500000",
                has_primary_key: true,
                primary_key_column: "order_id, product_id",
                has_foreign_key: true,
                foreign_key_column: "order_id",
                foreign_key_table: "orders"
            }
        ],
        indexes: [
            {
                name: "idx_customers_email",
                table: "customers",
                definition: "CREATE UNIQUE INDEX idx_customers_email ON customers(email);"
            },
            {
                name: "idx_orders_customer",
                table: "orders",
                definition: "CREATE INDEX idx_orders_customer ON orders(customer_id);"
            },
            {
                name: "idx_orders_date",
                table: "orders",
                definition: "CREATE INDEX idx_orders_date ON orders(order_date);"
            },
            {
                name: "idx_order_items_product",
                table: "order_items",
                definition: "CREATE INDEX idx_order_items_product ON order_items(product_id);"
            }
        ],
        explain: `QUERY PLAN
|--SCAN TABLE customers AS c
|--SEARCH TABLE orders AS o USING INDEX idx_orders_customer (customer_id=?)
|  |--USING AUTOMATIC INDEX
|--SEARCH TABLE order_items AS oi USING INDEX sqlite_autoindex_order_items_1 (order_id=?)
|--SEARCH TABLE products AS p USING INDEX sqlite_autoindex_products_1 (product_id=?)
|--USE TEMP B-TREE FOR GROUP BY
|--USE TEMP B-TREE FOR ORDER BY`
    }
}; 