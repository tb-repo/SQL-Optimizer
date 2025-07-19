// Query Templates Library
// Comprehensive collection of best-practice SQL templates for different scenarios

const queryTemplates = {
    // Basic SELECT queries
    basic: {
        name: "Basic SELECT",
        description: "Simple SELECT with WHERE clause and LIMIT",
        category: "Basic",
        difficulty: "Beginner",
        sql: `SELECT id, name, email, created_at
FROM users
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 10;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(255) UNIQUE, status VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
                rows: "10000",
                size: "50MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            }
        ],
        indexes: [
            {
                name: "idx_users_status",
                table: "users",
                definition: "CREATE INDEX idx_users_status ON users(status);",
                size: "5MB"
            },
            {
                name: "idx_users_created_at",
                table: "users",
                definition: "CREATE INDEX idx_users_created_at ON users(created_at);",
                size: "8MB"
            }
        ],
        tips: [
            "Always specify only the columns you need",
            "Use LIMIT to prevent large result sets",
            "Index columns used in WHERE and ORDER BY clauses"
        ]
    },

    // JOIN queries
    joins: {
        name: "JOIN with Multiple Tables",
        description: "INNER JOIN with proper indexing strategy",
        category: "Joins",
        difficulty: "Intermediate",
        sql: `SELECT u.name, p.title, c.comment
FROM users u
INNER JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON p.id = c.post_id
WHERE u.status = 'active' 
  AND p.published = true
ORDER BY p.created_at DESC
LIMIT 20;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(255), status VARCHAR(20), created_at TIMESTAMP);",
                rows: "50000",
                size: "200MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            },
            {
                name: "posts",
                ddl: "CREATE TABLE posts (id INT PRIMARY KEY, user_id INT, title VARCHAR(200), content TEXT, published BOOLEAN, created_at TIMESTAMP);",
                rows: "200000",
                size: "1GB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: true,
                foreign_key_column: "user_id",
                foreign_key_table: "users"
            },
            {
                name: "comments",
                ddl: "CREATE TABLE comments (id INT PRIMARY KEY, post_id INT, user_id INT, comment TEXT, created_at TIMESTAMP);",
                rows: "500000",
                size: "2GB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: true,
                foreign_key_column: "post_id",
                foreign_key_table: "posts"
            }
        ],
        indexes: [
            {
                name: "idx_posts_user_id",
                table: "posts",
                definition: "CREATE INDEX idx_posts_user_id ON posts(user_id);",
                size: "50MB"
            },
            {
                name: "idx_posts_published_created",
                table: "posts",
                definition: "CREATE INDEX idx_posts_published_created ON posts(published, created_at);",
                size: "100MB"
            },
            {
                name: "idx_comments_post_id",
                table: "comments",
                definition: "CREATE INDEX idx_comments_post_id ON comments(post_id);",
                size: "80MB"
            }
        ],
        tips: [
            "Use INNER JOIN for required relationships",
            "Use LEFT JOIN for optional relationships",
            "Index foreign key columns for better JOIN performance",
            "Consider composite indexes for frequently used column combinations"
        ]
    },

    // Aggregation queries
    aggregation: {
        name: "Aggregation with GROUP BY",
        description: "Complex aggregation with proper indexing",
        category: "Aggregation",
        difficulty: "Intermediate",
        sql: `SELECT 
    u.name,
    COUNT(o.id) as order_count,
    SUM(o.amount) as total_amount,
    AVG(o.amount) as avg_order_value
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
  AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 0
ORDER BY total_amount DESC
LIMIT 10;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(255), status VARCHAR(20), created_at TIMESTAMP);",
                rows: "100000",
                size: "500MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            },
            {
                name: "orders",
                ddl: "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT, amount DECIMAL(10,2), status VARCHAR(20), created_at TIMESTAMP);",
                rows: "1000000",
                size: "5GB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: true,
                foreign_key_column: "user_id",
                foreign_key_table: "users"
            }
        ],
        indexes: [
            {
                name: "idx_orders_user_id",
                table: "orders",
                definition: "CREATE INDEX idx_orders_user_id ON orders(user_id);",
                size: "200MB"
            },
            {
                name: "idx_orders_created_at",
                table: "orders",
                definition: "CREATE INDEX idx_orders_created_at ON orders(created_at);",
                size: "300MB"
            },
            {
                name: "idx_users_status",
                table: "users",
                definition: "CREATE INDEX idx_users_status ON users(status);",
                size: "20MB"
            }
        ],
        tips: [
            "Use HAVING for filtering aggregated results",
            "Index columns used in GROUP BY and WHERE clauses",
            "Consider materialized views for complex aggregations",
            "Use appropriate data types for monetary values"
        ]
    },

    // Window functions
    window_functions: {
        name: "Window Functions",
        description: "Advanced analytics with window functions",
        category: "Advanced",
        difficulty: "Advanced",
        sql: `SELECT 
    product_name,
    category,
    sales_amount,
    ROW_NUMBER() OVER (PARTITION BY category ORDER BY sales_amount DESC) as rank_in_category,
    LAG(sales_amount, 1) OVER (PARTITION BY category ORDER BY sales_date) as prev_sales,
    AVG(sales_amount) OVER (PARTITION BY category) as avg_category_sales
FROM sales
WHERE sales_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY category, sales_amount DESC;`,
        tables: [
            {
                name: "sales",
                ddl: "CREATE TABLE sales (id INT PRIMARY KEY, product_name VARCHAR(200), category VARCHAR(100), sales_amount DECIMAL(10,2), sales_date DATE);",
                rows: "500000",
                size: "2GB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            }
        ],
        indexes: [
            {
                name: "idx_sales_category_date",
                table: "sales",
                definition: "CREATE INDEX idx_sales_category_date ON sales(category, sales_date);",
                size: "150MB"
            },
            {
                name: "idx_sales_date",
                table: "sales",
                definition: "CREATE INDEX idx_sales_date ON sales(sales_date);",
                size: "100MB"
            }
        ],
        tips: [
            "Window functions are powerful for analytics",
            "Use PARTITION BY to group data within windows",
            "ORDER BY within windows determines the sequence",
            "Consider performance impact on large datasets"
        ]
    },

    // Subqueries
    subqueries: {
        name: "Subqueries and CTEs",
        description: "Complex queries using subqueries and Common Table Expressions",
        category: "Advanced",
        difficulty: "Advanced",
        sql: `WITH user_stats AS (
    SELECT 
        user_id,
        COUNT(*) as order_count,
        SUM(amount) as total_spent
    FROM orders
    WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY user_id
    HAVING COUNT(*) > 5
),
top_customers AS (
    SELECT user_id
    FROM user_stats
    WHERE total_spent > (
        SELECT AVG(total_spent) * 2 
        FROM user_stats
    )
)
SELECT 
    u.name,
    u.email,
    us.order_count,
    us.total_spent
FROM users u
INNER JOIN user_stats us ON u.id = us.user_id
INNER JOIN top_customers tc ON u.id = tc.user_id
WHERE u.status = 'active'
ORDER BY us.total_spent DESC;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(255), status VARCHAR(20), created_at TIMESTAMP);",
                rows: "50000",
                size: "250MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            },
            {
                name: "orders",
                ddl: "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT, amount DECIMAL(10,2), status VARCHAR(20), created_at TIMESTAMP);",
                rows: "500000",
                size: "2.5GB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: true,
                foreign_key_column: "user_id",
                foreign_key_table: "users"
            }
        ],
        indexes: [
            {
                name: "idx_orders_user_created",
                table: "orders",
                definition: "CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);",
                size: "200MB"
            },
            {
                name: "idx_orders_amount",
                table: "orders",
                definition: "CREATE INDEX idx_orders_amount ON orders(amount);",
                size: "150MB"
            }
        ],
        tips: [
            "CTEs improve query readability and maintainability",
            "Use CTEs for complex multi-step calculations",
            "Consider materializing CTEs for repeated use",
            "Subqueries can be rewritten as JOINs for better performance"
        ]
    },

    // Performance optimization
    performance: {
        name: "Performance Optimized Query",
        description: "Query designed for maximum performance with proper indexing",
        category: "Performance",
        difficulty: "Expert",
        sql: `SELECT 
    p.id,
    p.title,
    p.created_at,
    u.name as author_name,
    COUNT(c.id) as comment_count
FROM posts p
INNER JOIN users u ON p.user_id = u.id
LEFT JOIN comments c ON p.id = c.post_id
WHERE p.published = true
  AND p.created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND u.status = 'active'
GROUP BY p.id, p.title, p.created_at, u.name
ORDER BY p.created_at DESC, comment_count DESC
LIMIT 50;`,
        tables: [
            {
                name: "posts",
                ddl: "CREATE TABLE posts (id INT PRIMARY KEY, user_id INT, title VARCHAR(200), content TEXT, published BOOLEAN, created_at TIMESTAMP);",
                rows: "1000000",
                size: "5GB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: true,
                foreign_key_column: "user_id",
                foreign_key_table: "users"
            },
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(255), status VARCHAR(20), created_at TIMESTAMP);",
                rows: "100000",
                size: "500MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            },
            {
                name: "comments",
                ddl: "CREATE TABLE comments (id INT PRIMARY KEY, post_id INT, user_id INT, comment TEXT, created_at TIMESTAMP);",
                rows: "2000000",
                size: "8GB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: true,
                foreign_key_column: "post_id",
                foreign_key_table: "posts"
            }
        ],
        indexes: [
            {
                name: "idx_posts_published_created",
                table: "posts",
                definition: "CREATE INDEX idx_posts_published_created ON posts(published, created_at DESC);",
                size: "200MB"
            },
            {
                name: "idx_posts_user_id",
                table: "posts",
                definition: "CREATE INDEX idx_posts_user_id ON posts(user_id);",
                size: "100MB"
            },
            {
                name: "idx_users_status",
                table: "users",
                definition: "CREATE INDEX idx_users_status ON users(status);",
                size: "30MB"
            },
            {
                name: "idx_comments_post_id",
                table: "comments",
                definition: "CREATE INDEX idx_comments_post_id ON comments(post_id);",
                size: "300MB"
            }
        ],
        tips: [
            "Use covering indexes to avoid table lookups",
            "Order columns in composite indexes by selectivity",
            "Consider partial indexes for filtered data",
            "Use EXPLAIN ANALYZE to verify execution plans"
        ]
    },

    // JSON Basic Operations
    json_basic: {
        name: "JSON Basic Operations",
        description: "Basic JSON extraction and manipulation in PostgreSQL",
        category: "JSON",
        difficulty: "Beginner",
        sql: `SELECT 
    id,
    name,
    profile->>'email' as email,
    profile->>'phone' as phone,
    profile->'address'->>'city' as city,
    profile->'preferences'->>'theme' as theme
FROM users
WHERE profile->>'status' = 'active'
  AND profile->'address'->>'country' = 'USA'
ORDER BY (profile->>'last_login')::timestamp DESC
LIMIT 10;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), profile JSONB);",
                rows: "50000",
                size: "200MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            }
        ],
        indexes: [
            {
                name: "idx_users_profile_gin",
                table: "users",
                definition: "CREATE INDEX idx_users_profile_gin ON users USING GIN (profile);",
                size: "50MB"
            },
            {
                name: "idx_users_profile_status",
                table: "users",
                definition: "CREATE INDEX idx_users_profile_status ON users ((profile->>'status'));",
                size: "20MB"
            }
        ],
        tips: [
            "Use ->> operator to extract text values from JSON",
            "Use -> operator to extract JSON objects/arrays",
            "Use GIN indexes for efficient JSON querying",
            "Cast JSON values to appropriate data types when needed"
        ]
    },

    // JSON Aggregation
    json_aggregation: {
        name: "JSON Aggregation and Grouping",
        description: "Aggregating JSON data with GROUP BY and JSON functions",
        category: "JSON",
        difficulty: "Intermediate",
        sql: `SELECT 
    profile->>'department' as department,
    COUNT(*) as employee_count,
    AVG((profile->>'salary')::numeric) as avg_salary,
    jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'salary', profile->>'salary'
        )
    ) as employees
FROM users
WHERE profile->>'status' = 'active'
GROUP BY profile->>'department'
HAVING COUNT(*) > 5
ORDER BY avg_salary DESC;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), profile JSONB);",
                rows: "100000",
                size: "500MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            }
        ],
        indexes: [
            {
                name: "idx_users_profile_gin",
                table: "users",
                definition: "CREATE INDEX idx_users_profile_gin ON users USING GIN (profile);",
                size: "100MB"
            },
            {
                name: "idx_users_department",
                table: "users",
                definition: "CREATE INDEX idx_users_department ON users ((profile->>'department'));",
                size: "30MB"
            }
        ],
        tips: [
            "Use jsonb_agg() to aggregate JSON objects into arrays",
            "Use jsonb_build_object() to construct JSON objects",
            "Index JSON path expressions for better performance",
            "Consider using JSONB instead of JSON for better performance"
        ]
    },

    // JSON Array Operations
    json_arrays: {
        name: "JSON Array Operations",
        description: "Working with JSON arrays and array functions",
        category: "JSON",
        difficulty: "Intermediate",
        sql: `SELECT 
    id,
    name,
    profile->>'email' as email,
    jsonb_array_length(profile->'skills') as skill_count,
    jsonb_array_elements_text(profile->'skills') as skill
FROM users
WHERE profile->>'status' = 'active'
  AND jsonb_array_length(profile->'skills') > 3
  AND profile->'skills' ? 'SQL'
ORDER BY skill_count DESC, name;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), profile JSONB);",
                rows: "75000",
                size: "300MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            }
        ],
        indexes: [
            {
                name: "idx_users_profile_gin",
                table: "users",
                definition: "CREATE INDEX idx_users_profile_gin ON users USING GIN (profile);",
                size: "75MB"
            },
            {
                name: "idx_users_skills",
                table: "users",
                definition: "CREATE INDEX idx_users_skills ON users USING GIN ((profile->'skills'));",
                size: "40MB"
            }
        ],
        tips: [
            "Use jsonb_array_length() to count array elements",
            "Use jsonb_array_elements_text() to unnest text arrays",
            "Use ? operator to check if array contains a value",
            "GIN indexes work well with JSON arrays"
        ]
    },

    // JSON Path Queries
    json_path: {
        name: "JSON Path Queries",
        description: "Advanced JSON path expressions and nested queries",
        category: "JSON",
        difficulty: "Advanced",
        sql: `SELECT 
    id,
    name,
    profile->>'email' as email,
    profile->'address'->>'city' as city,
    profile->'orders'->0->>'total' as last_order_total,
    profile->'orders'->0->>'date' as last_order_date
FROM users
WHERE profile->'orders' @> '[{\"status\": \"completed\"}]'
  AND (profile->'orders'->0->>'total')::numeric > 100
  AND profile->'preferences'->>'newsletter' = 'true'
ORDER BY (profile->'orders'->0->>'total')::numeric DESC
LIMIT 20;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), profile JSONB);",
                rows: "100000",
                size: "800MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            }
        ],
        indexes: [
            {
                name: "idx_users_profile_gin",
                table: "users",
                definition: "CREATE INDEX idx_users_profile_gin ON users USING GIN (profile);",
                size: "200MB"
            },
            {
                name: "idx_users_orders_status",
                table: "users",
                definition: "CREATE INDEX idx_users_orders_status ON users USING GIN ((profile->'orders'));",
                size: "150MB"
            }
        ],
        tips: [
            "Use @> operator for containment queries",
            "Use array indexing (->0) to access first element",
            "Cast JSON numeric values for comparisons",
            "Use GIN indexes for complex JSON queries"
        ]
    },

    // JSON Schema Validation
    json_schema: {
        name: "JSON Schema Validation",
        description: "Validating JSON data against schemas and constraints",
        category: "JSON",
        difficulty: "Advanced",
        sql: `SELECT 
    id,
    name,
    profile,
    CASE 
        WHEN jsonb_typeof(profile->'email') = 'string' 
        AND profile->>'email' ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
        THEN 'Valid Email'
        ELSE 'Invalid Email'
    END as email_validation,
    CASE 
        WHEN jsonb_typeof(profile->'age') = 'number'
        AND (profile->>'age')::int BETWEEN 18 AND 100
        THEN 'Valid Age'
        ELSE 'Invalid Age'
    END as age_validation
FROM users
WHERE jsonb_typeof(profile->'email') = 'string'
  AND jsonb_typeof(profile->'age') = 'number'
  AND profile->>'email' ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
  AND (profile->>'age')::int BETWEEN 18 AND 100;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), profile JSONB);",
                rows: "50000",
                size: "250MB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            }
        ],
        indexes: [
            {
                name: "idx_users_profile_gin",
                table: "users",
                definition: "CREATE INDEX idx_users_profile_gin ON users USING GIN (profile);",
                size: "60MB"
            }
        ],
        tips: [
            "Use jsonb_typeof() to check JSON data types",
            "Use regex patterns for email validation",
            "Cast JSON values for range comparisons",
            "Consider using CHECK constraints for validation"
        ]
    },

    // JSON Performance Optimization
    json_performance: {
        name: "JSON Performance Optimization",
        description: "Optimized JSON queries with proper indexing strategies",
        category: "JSON",
        difficulty: "Expert",
        sql: `WITH user_stats AS (
    SELECT 
        profile->>'department' as department,
        COUNT(*) as user_count,
        AVG((profile->>'salary')::numeric) as avg_salary,
        jsonb_object_agg(
            profile->>'level',
            COUNT(*)
        ) as level_distribution
    FROM users
    WHERE profile->>'status' = 'active'
      AND profile ? 'department'
      AND profile ? 'salary'
    GROUP BY profile->>'department'
),
department_rankings AS (
    SELECT 
        department,
        user_count,
        avg_salary,
        level_distribution,
        ROW_NUMBER() OVER (ORDER BY avg_salary DESC) as salary_rank,
        ROW_NUMBER() OVER (ORDER BY user_count DESC) as size_rank
    FROM user_stats
)
SELECT 
    department,
    user_count,
    ROUND(avg_salary::numeric, 2) as avg_salary,
    level_distribution,
    salary_rank,
    size_rank
FROM department_rankings
WHERE salary_rank <= 5 OR size_rank <= 5
ORDER BY avg_salary DESC;`,
        tables: [
            {
                name: "users",
                ddl: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), profile JSONB);",
                rows: "200000",
                size: "1GB",
                has_primary_key: true,
                primary_key_column: "id",
                has_foreign_key: false,
                foreign_key_column: "",
                foreign_key_table: ""
            }
        ],
        indexes: [
            {
                name: "idx_users_profile_gin",
                table: "users",
                definition: "CREATE INDEX idx_users_profile_gin ON users USING GIN (profile);",
                size: "250MB"
            },
            {
                name: "idx_users_department_status",
                table: "users",
                definition: "CREATE INDEX idx_users_department_status ON users ((profile->>'department'), (profile->>'status'));",
                size: "80MB"
            },
            {
                name: "idx_users_salary",
                table: "users",
                definition: "CREATE INDEX idx_users_salary ON users ((profile->>'salary')::numeric);",
                size: "100MB"
            }
        ],
        tips: [
            "Use CTEs to break down complex JSON queries",
            "Create functional indexes on frequently accessed JSON paths",
            "Use jsonb_object_agg() for efficient aggregation",
            "Consider partial indexes for filtered JSON data"
        ]
    }
};

// Template categories for organization
const templateCategories = [
    { id: 'basic', name: 'Basic Queries', description: 'Simple SELECT statements' },
    { id: 'joins', name: 'JOIN Operations', description: 'Multi-table queries with JOINs' },
    { id: 'aggregation', name: 'Aggregation', description: 'GROUP BY and aggregate functions' },
    { id: 'window_functions', name: 'Window Functions', description: 'Advanced analytics' },
    { id: 'subqueries', name: 'Subqueries & CTEs', description: 'Complex nested queries' },
    { id: 'json', name: 'JSON Operations', description: 'JSON data manipulation and querying' },
    { id: 'performance', name: 'Performance', description: 'Optimized for speed' }
];

// Difficulty levels
const difficultyLevels = [
    { id: 'beginner', name: 'Beginner', color: 'success' },
    { id: 'intermediate', name: 'Intermediate', color: 'warning' },
    { id: 'advanced', name: 'Advanced', color: 'info' },
    { id: 'expert', name: 'Expert', color: 'danger' }
]; 