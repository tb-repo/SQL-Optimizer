// Reserved words should be loaded prior from wordlist.js

// Initialize DOM elements when they're available
let cell_input, cell_output, textarea;

// Load Sample Data functionality
function loadSampleData(engine) {
    if (engine === 'sqlserver') {
        // Load SQL Server sample data
        const sampleData = SQL_SERVER_SAMPLE_DATA;
        
        // Populate the form fields
        document.getElementById('sql_query_textarea').value = sampleData.sql_query;
        document.getElementById('explain_plan_textarea').value = sampleData.explain_plan_xml;
        
        // Note: We don't automatically change the selected database engine
        // The user should manually select the appropriate engine for their data
        
        // Clear existing tables and add the sample tables
        const tablesContainer = document.getElementById('tables-container');
        if (tablesContainer) {
            tablesContainer.innerHTML = '';
            
            // Add Customers table
            addTable('Customers', sampleData.table_ddl.split('-- Customers table')[1].split('-- Orders table')[0].trim(), '5000', '2MB');
            
            // Add Orders table
            addTable('Orders', sampleData.table_ddl.split('-- Orders table')[1].split('-- OrderDetails table')[0].trim(), '50000', '15MB');
            
            // Add OrderDetails table
            addTable('OrderDetails', sampleData.table_ddl.split('-- OrderDetails table')[1].trim(), '100000', '25MB');
        }
        
        // Add indexes section
        const indexesContainer = document.getElementById('indexes-container');
        if (indexesContainer) {
            indexesContainer.innerHTML = '';
            
            // Add the sample indexes
            const indexStatements = sampleData.index_ddl.split('\n').filter(line => line.trim().startsWith('CREATE INDEX'));
            indexStatements.forEach(indexStmt => {
                const match = indexStmt.match(/CREATE INDEX (\w+) ON (\w+)/);
                if (match) {
                    const indexName = match[1];
                    const tableName = match[2];
                    addIndex(tableName, indexName, indexStmt, 'Active');
                }
            });
        }
        
        // Show success message
        showNotification('SQL Server sample data loaded successfully! Check the analysis for performance insights.', 'success');
        
        // Trigger any necessary updates
        if (typeof updateEngineTips === 'function') {
            updateEngineTips();
        }
        
        // Trigger validation
        if (typeof validateExplain === 'function') {
            validateExplain();
        }
    } else {
        showNotification('Sample data not available for this engine yet.', 'info');
    }
}

// Show notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Create a Resize function and add a Resize observer on the textbox //
// All text functions should go here 

const equalResize = () => {
    if (!textarea || !cell_input || !cell_output) return;
    
    try {
		let bounds = textarea.getBoundingClientRect()
		cell_input.style.minHeight = bounds.height + 'px' // Allows the Outer Div to collapse
		cell_output.style.minHeight = bounds.height + 'px'
		cell_output.style.minWidth = bounds.width + 'px'
    } catch (e) {
        console.log('equalResize error:', e);
    }
	return null
}

// Initialize elements when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    cell_input = document.getElementById('cell_input');
    cell_output = document.getElementById('cell_output');
    textarea = document.getElementById('textarea');
    
    if (textarea && cell_input && cell_output) {
        equalResize();
        new ResizeObserver(equalResize).observe(cell_input);
    }
});



// Need a function to evaluate the contents of the input textbox //


// I keep creating classed spans, so I might as well just make it a function
const spanClass = ( _class = '' , txt = '' ) => {
	return `<span class="${_class}">${txt}</span>`
}


// \t|\s|\(|\)|\[|\]

const wordChecker = (wordlist, text) => {
	let upper = text.toUpperCase()

	let match = wordlist.find( word => word === upper)?? null
	let isMatch = match? true: false 
	let out = isMatch? upper: text

	return {isMatch, out} 

}

const update = (wordlist = null) =>{
    if (!textarea || !cell_output) return;
    
    try {
	let dicedInput = textarea.value.split(/(?=[\t|\s|\(|\)|\[|\]])|(?<=[\t|\s|\(|\)|\[|\]])/g)
	// console.log(dicedInput)

	let outputHTML = dicedInput.map( el => {
		if(el == '\n' ){ return spanClass( 'linebreak' , '<br>') }
		if(el == '\t' ){ return spanClass('tabspace', '&nbsp;&nbsp;&nbsp;&nbsp;' ) }
		

			// quotes // 
		if( /'/.test(el) ){ return spanClass('singlequotes', el) }
		if( /"/.test(el) ){ return spanClass('danger', el) }

			// letters
		if( /[a-z]/i.test(el) ){ // we will be doing more with this later 
			if(wordlist){
				let {isMatch, out} = wordChecker(wordlist, el)
				let _cls = isMatch? 'matched' : 'letters'
				return spanClass( _cls, out)
			} else {
				return spanClass('letters', el)
			}
		} 

			// just numbers //
		if( /\d/.test(el) ){ // numbers only
			return spanClass('numbers', el)
		}

			// brackets //
		if( /[\(|\)|\[|\]]/.test(el)){ return spanClass('brackets', el) }
		if(!/[a-z\d]/i.test(el)){ return `<span class="whitespace">${el}</span>` }
		return el
	})
	.join('')

	//console.log(outputHTML)
	cell_output.innerHTML = outputHTML
    } catch (e) {
        console.log('update function error:', e);
    }
}


// Initialize update function when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (typeof update === 'function' && typeof reserved_words !== 'undefined') {
        update(reserved_words);
    }
});

// Add event listener when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (textarea) {
textarea.addEventListener('keydown', function(e) {
  if (e.key == 'Tab') {
    e.preventDefault();
    var start = this.selectionStart;
    var end = this.selectionEnd;

    // set textarea value to: text before caret + tab + text after caret
    this.value = this.value.substring(0, start) +
      "\t" + this.value.substring(end);

    // put caret at right position again
    this.selectionStart =
      this.selectionEnd = start + 1;
  }

            if (typeof update === 'function' && typeof reserved_words !== 'undefined') {
                update(reserved_words);
            }
        });
    }
});

// Load tips from external file
let currentTipIndex = 0;

// Initialize tips when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tips after a short delay to ensure tips.js is loaded
    setTimeout(() => {
        initializeTips();
    }, 100);
});

function initializeTips() {
    // Get tips from the global engineTips variable (loaded from tips.js)
    if (typeof window.engineTips !== 'undefined') {
        // Use the global engineTips directly
        updateEngineTips();
        
        // Start the rotation timer
        startTipsRotation();
        
        // Add event listener for engine changes
        const engineSelect = document.getElementById('db_engine_select');
        if (engineSelect) {
            engineSelect.addEventListener('change', updateEngineTips);
        }
    }
}

function updateEngineTips() {
    const engineSelect = document.getElementById('db_engine_select');
    const tipsContainer = document.getElementById('engine-tips-single');
    const engineNameSpan = document.getElementById('engine-tips-engine');
    
    if (!engineSelect || !tipsContainer || !engineNameSpan) return;
    
    const selectedEngine = engineSelect.value;
    const tips = window.engineTips[selectedEngine] || [];
    
    if (tips.length > 0) {
        // Update engine name
        engineNameSpan.textContent = selectedEngine;
        
        // Show first tip
        currentTipIndex = 0;
        showCurrentTip();
        
        // Reset progress bar
        resetProgressBar();
    }
}

function showCurrentTip() {
    const engineSelect = document.getElementById('db_engine_select');
    const tipsContainer = document.getElementById('engine-tips-single');
    
    if (!engineSelect || !tipsContainer) return;
    
    const selectedEngine = engineSelect.value;
    const tips = window.engineTips[selectedEngine] || [];
    
    if (tips.length > 0) {
        const tipText = tips[currentTipIndex];
        
        // Set the tip text directly
        tipsContainer.textContent = tipText;
        
        // Reset progress bar
        resetProgressBar();
    }
}

function resetProgressBar() {
    const progressBar = document.querySelector('.did-you-know-progress-bar');
    if (progressBar) {
        progressBar.style.animation = 'none';
        progressBar.offsetHeight; // Trigger reflow
        progressBar.style.animation = 'progress-fill 15s linear infinite';
    }
}

function startTipsRotation() {
    setInterval(() => {
        const engineSelect = document.getElementById('db_engine_select');
        if (!engineSelect) return;
        
        const selectedEngine = engineSelect.value;
        const tips = window.engineTips[selectedEngine] || [];
        
        if (tips.length > 1) {
            currentTipIndex = (currentTipIndex + 1) % tips.length;
            showCurrentTip();
        }
    }, 15000); // Rotate every 15 seconds
}

// --- CSV Upload and Modal Logic ---
document.addEventListener('DOMContentLoaded', function() {
    // CSV upload handlers
    document.getElementById('csv-table-upload')?.addEventListener('change', handleTableCSVUpload);
    document.getElementById('csv-index-upload')?.addEventListener('change', handleIndexCSVUpload);
    document.getElementById('csv-explain-upload')?.addEventListener('change', handleExplainCSVUpload);

    // Modal population handler (Bootstrap 5, no jQuery)
    const csvHelpBtn = document.getElementById('csvHelpModalBtn');
    if (csvHelpBtn) {
        csvHelpBtn.addEventListener('click', function() {
            populateCSVHelpModal();
            const modalEl = document.getElementById('csvHelpModal');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        });
    }
});

// Helper: Load PapaParse if not present
function ensurePapaParse(callback) {
    if (window.Papa) return callback();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
    script.onload = callback;
    document.head.appendChild(script);
}

function handleTableCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    ensurePapaParse(() => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const data = results.data;
                if (!Array.isArray(data) || data.length === 0) {
                    alert('No rows found in Table CSV.');
                    return;
                }
                // Clear existing tables
                const tablesContainer = document.getElementById('tables-container');
                tablesContainer.innerHTML = '';
                // Try to map columns
                data.forEach(row => {
                    addTable(
                        row.table_name || row.TABLE_NAME || row.name || '',
                        row.ddl || row.DDL || row['Create Table'] || '',
                        row.row_count || row.TABLE_ROWS || row.num_rows || row.rows || '',
                        row.total_size || row.total_mb || row.size || '',
                        row.has_primary_key === 'true' || row.has_primary_key === true,
                        row.primary_key_column || '',
                        row.has_foreign_key === 'true' || row.has_foreign_key === true,
                        row.foreign_key_column || '',
                        row.foreign_key_table || ''
                    );
                });
            },
            error: function(err) {
                alert('Error parsing Table CSV: ' + err.message);
            }
        });
    });
}

function handleIndexCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    ensurePapaParse(() => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const data = results.data;
                if (!Array.isArray(data) || data.length === 0) {
                    alert('No rows found in Index CSV.');
                    return;
                }
                // Clear existing indexes
                const indexesContainer = document.getElementById('indexes-container');
                indexesContainer.innerHTML = '';
                // Try to map columns
                data.forEach(row => {
                    addIndex(
                        row.index_name || row.Key_name || row.name || '',
                        row.table_name || row.Table || row.table || '',
                        row.indexdef || row.definition || row['Create Index'] || row.indexdef || '',
                        row.index_size || row.size || row.index_size_mb || ''
                    );
                });
            },
            error: function(err) {
                alert('Error parsing Index CSV: ' + err.message);
            }
        });
    });
}

function handleExplainCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    ensurePapaParse(() => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: false,
            complete: function(results) {
                const data = results.data;
                // Try to join all rows into a single string for the textarea
                let explainText = '';
                if (Array.isArray(data) && data.length > 0) {
                    // If column QUERY PLAN or Plan exists, join those
                    if (data[0]['QUERY PLAN']) {
                        explainText = data.map(r => r['QUERY PLAN']).join('\n');
                    } else if (data[0]['Plan']) {
                        explainText = data.map(r => r['Plan']).join('\n');
                    } else {
                        // Fallback: join all values
                        explainText = data.map(r => Object.values(r).join(' | ')).join('\n');
                    }
                }
                document.getElementById('explain_plan_textarea').value = explainText;
                
                // Show success message
                const feedback = document.getElementById('explain_plan_feedback');
                if (feedback) {
                    feedback.innerHTML = `<i class="fas fa-check text-success me-1"></i>EXPLAIN plan CSV loaded successfully! The visualization will be generated when you analyze the query.`;
                    feedback.style.color = '#22c55e';
                    feedback.setAttribute('aria-live', 'polite');
                }
            },
            error: function(err) {
                alert('Error parsing Explain Plan CSV: ' + err.message);
            }
        });
    });
}

function populateCSVHelpModal() {
    const helpContent = document.getElementById('csv-help-content');
    if (!helpContent) return;

    // Get user SQL and DB engine
    const sql = document.getElementById('sql_query_textarea')?.value || '';
    const dbEngine = document.getElementById('db_engine_select')?.value || 'postgresql';
    const tableNames = extractTableNames(sql);

    // Generate SQLs and columns for each section
    const modalSections = [
        generateTableSection(dbEngine, tableNames),
        generateIndexSection(dbEngine, tableNames),
        generateExplainSection(dbEngine, sql),
        generatePKSection(dbEngine, tableNames),
        generateFKSection(dbEngine, tableNames)
    ];

    // Wrap in Bootstrap 5 accordion
    helpContent.innerHTML = `
      <div class="accordion" id="csvHelpAccordion">
        ${modalSections.map((section, idx) =>
          makeCollapsible(section.title, section.sql, section.columns, idx)
        ).join('')}
      </div>
    `;
}

// Helper to get content for each section
function getSectionContent(idx, dbEngine, tableNames, sql) {
    switch(idx) {
        case 0: return [generateTableSection(dbEngine, tableNames).title, generateTableSection(dbEngine, tableNames).sql, generateTableSection(dbEngine, tableNames).columns];
        case 1: return [generateIndexSection(dbEngine, tableNames).title, generateIndexSection(dbEngine, tableNames).sql, generateIndexSection(dbEngine, tableNames).columns];
        case 2: return [generateExplainSection(dbEngine, sql).title, generateExplainSection(dbEngine, sql).sql, generateExplainSection(dbEngine, sql).columns];
        case 3: return [generatePKSection(dbEngine, tableNames).title, generatePKSection(dbEngine, tableNames).sql, generatePKSection(dbEngine, tableNames).columns];
        case 4: return [generateFKSection(dbEngine, tableNames).title, generateFKSection(dbEngine, tableNames).sql, generateFKSection(dbEngine, tableNames).columns];
        default: return ['', '', []];
    }
}

function extractTableNames(sql) {
    // Remove CTEs (everything before the main SELECT)
    let cleaned = sql.replace(/WITH[\s\S]+?\)\s*SELECT/i, 'SELECT');
    // Remove comments
    cleaned = cleaned.replace(/--.*?\n|\/\*[\s\S]*?\*\//g, ' ');
    // Find all table names after FROM or JOIN, ignoring subqueries and aliases
    const regex = /(?:FROM|JOIN)\s+([\w.\"]+)(?!\s*\))/gi;
    let match, tables = new Set();
    while ((match = regex.exec(cleaned)) !== null) {
        let t = match[1].replace(/['"`]/g, '');
        // Remove schema if present
        if (t.includes('.')) t = t.split('.')[1];
        // Ignore subqueries (starts with '(')
        if (!t.startsWith('(')) tables.add(t);
    }
    return Array.from(tables).filter(Boolean);
}

function generateTableSection(engine, tables) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `SELECT relname AS table_name, n_live_tup AS row_count FROM pg_stat_user_tables WHERE relname IN (${tables.map(t => `'${t}'`).join(', ')});\nSELECT relname AS table_name, pg_size_pretty(pg_total_relation_size(relid)) AS total_size FROM pg_catalog.pg_statio_user_tables WHERE relname IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'row_count', 'total_size'];
    } else if (engine === 'mysql') {
        sql = `SELECT TABLE_NAME, TABLE_ROWS, ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS total_mb FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['TABLE_NAME', 'TABLE_ROWS', 'total_mb'];
    } else if (engine === 'sqlserver') {
        sql = `SELECT t.name AS table_name, SUM(p.rows) AS row_count FROM sys.tables t INNER JOIN sys.partitions p ON t.object_id = p.object_id WHERE t.name IN (${tables.map(t => `'${t}'`).join(', ')}) AND p.index_id IN (0,1) GROUP BY t.name;`;
        columns = ['table_name', 'row_count'];
    } else if (engine === 'oracle') {
        sql = `SELECT table_name, num_rows, ROUND((data_length + nvl(index_length,0))/1024/1024,2) AS total_mb FROM user_tables WHERE table_name IN (${tables.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
        columns = ['table_name', 'num_rows', 'total_mb'];
    } else if (engine === 'sqlite') {
        sql = tables.map(t => `SELECT '${t}' AS table_name, (SELECT COUNT(*) FROM ${t}) AS row_count`).join(' UNION ALL\n');
        columns = ['table_name', 'row_count'];
    } else {
        sql = '-- Provide your table details as CSV';
        columns = [];
    }
    return {title: 'Table Details', sql, columns};
}

function generateIndexSection(engine, tables) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN (${tables.map(t => `'${t}'`).join(', ')});\nSELECT i.relname AS index_name, pg_size_pretty(pg_relation_size(i.oid)) AS index_size FROM pg_class t, pg_class i, pg_index ix WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND t.relkind = 'r' AND t.relname IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['tablename', 'indexname', 'indexdef', 'index_name', 'index_size'];
    } else if (engine === 'mysql') {
        sql = tables.map(t => `SHOW INDEX FROM ${t};`).join('\n');
        columns = ['Table', 'Non_unique', 'Key_name', 'Seq_in_index', 'Column_name', 'Collation', 'Cardinality', 'Sub_part', 'Packed', 'Null', 'Index_type', 'Comment', 'Index_comment'];
    } else if (engine === 'sqlserver') {
        sql = `SELECT t.name AS table_name, ind.name AS index_name, col.name AS column_name, ind.is_unique, ind.is_primary_key FROM sys.tables t JOIN sys.indexes ind ON t.object_id = ind.object_id JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id WHERE t.name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'index_name', 'column_name', 'is_unique', 'is_primary_key'];
    } else if (engine === 'oracle') {
        sql = `SELECT ind.table_name, ind.index_name, col.column_name, ind.uniqueness, ind.status, ind.tablespace_name FROM all_indexes ind JOIN all_ind_columns col ON ind.index_name = col.index_name WHERE ind.table_name IN (${tables.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
        columns = ['table_name', 'index_name', 'column_name', 'uniqueness', 'status', 'tablespace_name'];
    } else if (engine === 'sqlite') {
        sql = tables.map(t => `PRAGMA index_list('${t}');`).join('\n');
        columns = ['seq', 'name', 'unique', 'origin', 'partial'];
    } else {
        sql = '-- Provide your index details as CSV';
        columns = [];
    }
    return {title: 'Index Details', sql, columns};
}

function generateExplainSection(engine, sqlQuery) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `EXPLAIN (ANALYZE, COSTS, TIMING, FORMAT CSV)\n${sqlQuery.trim().replace(/;+$/, '')};`;
        columns = ['QUERY PLAN'];
    } else if (engine === 'mysql') {
        sql = `EXPLAIN ${sqlQuery.trim().replace(/;+$/, '')};`;
        columns = ['id', 'select_type', 'table', 'partitions', 'type', 'possible_keys', 'key', 'key_len', 'ref', 'rows', 'filtered', 'Extra'];
    } else if (engine === 'sqlserver') {
        sql = `SET SHOWPLAN_ALL ON;\n${sqlQuery.trim().replace(/;+$/, '')};\nSET SHOWPLAN_ALL OFF;`;
        columns = ['StmtText', 'StmtId', 'NodeId', 'Parent', 'PhysicalOp', 'LogicalOp', 'Argument', 'DefinedValues', 'EstimateRows', 'EstimateIO', 'EstimateCPU', 'AvgRowSize', 'TotalSubtreeCost', 'OutputList', 'Warnings', 'Type'];
    } else if (engine === 'oracle') {
        sql = `EXPLAIN PLAN FOR\n${sqlQuery.trim().replace(/;+$/, '')};\nSELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);`;
        columns = ['ID', 'OPERATION', 'OPTIONS', 'OBJECT_NAME', 'CARDINALITY', 'COST', 'BYTES', 'OTHER'];
    } else if (engine === 'sqlite') {
        sql = `EXPLAIN QUERY PLAN ${sqlQuery.trim().replace(/;+$/, '')};`;
        columns = ['id', 'parent', 'notused', 'detail'];
    } else {
        sql = '-- Provide your explain plan as CSV';
        columns = [];
    }
    return {title: 'EXPLAIN Plan (with Visualization)', sql, columns};
}

function generatePKSection(engine, tables) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `SELECT tc.table_name, kcu.column_name AS primary_key_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'primary_key_column'];
    } else if (engine === 'mysql') {
        sql = `SELECT TABLE_NAME, COLUMN_NAME AS primary_key_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY' AND TABLE_NAME IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['TABLE_NAME', 'primary_key_column'];
    } else if (engine === 'sqlserver') {
        sql = `SELECT t.name AS table_name, c.name AS primary_key_column FROM sys.tables t JOIN sys.indexes i ON t.object_id = i.object_id AND i.is_primary_key = 1 JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id WHERE t.name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'primary_key_column'];
    } else if (engine === 'oracle') {
        sql = `SELECT acc.table_name, acc.column_name AS primary_key_column FROM all_constraints ac JOIN all_cons_columns acc ON ac.constraint_name = acc.constraint_name WHERE ac.constraint_type = 'P' AND acc.table_name IN (${tables.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
        columns = ['table_name', 'primary_key_column'];
    } else if (engine === 'sqlite') {
        sql = tables.map(t => `PRAGMA table_info('${t}');`).join('\n');
        columns = ['pk', 'name', 'type', 'notnull', 'dflt_value', 'table_name'];
    } else {
        sql = '-- Provide your primary key details as CSV';
        columns = [];
    }
    return {title: 'Primary Key Details', sql, columns};
}

function generateFKSection(engine, tables) {
    let sql, columns;
    if (engine === 'postgresql') {
        sql = `SELECT tc.table_name, kcu.column_name AS foreign_key_column, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'foreign_key_column', 'referenced_table', 'referenced_column'];
    } else if (engine === 'mysql') {
        sql = `SELECT TABLE_NAME, COLUMN_NAME AS foreign_key_column, REFERENCED_TABLE_NAME AS referenced_table, REFERENCED_COLUMN_NAME AS referenced_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_NAME IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['TABLE_NAME', 'foreign_key_column', 'referenced_table', 'referenced_column'];
    } else if (engine === 'sqlserver') {
        sql = `SELECT parent.name AS table_name, c.name AS foreign_key_column, ref.name AS referenced_table, cref.name AS referenced_column FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id JOIN sys.tables parent ON fkc.parent_object_id = parent.object_id JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id JOIN sys.tables ref ON fkc.referenced_object_id = ref.object_id JOIN sys.columns cref ON fkc.referenced_object_id = cref.object_id AND fkc.referenced_column_id = cref.column_id WHERE parent.name IN (${tables.map(t => `'${t}'`).join(', ')});`;
        columns = ['table_name', 'foreign_key_column', 'referenced_table', 'referenced_column'];
    } else if (engine === 'oracle') {
        sql = `SELECT acc.table_name, acc.column_name AS foreign_key_column, r_acc.table_name AS referenced_table, r_acc.column_name AS referenced_column FROM all_constraints ac JOIN all_cons_columns acc ON ac.constraint_name = acc.constraint_name JOIN all_constraints r_ac ON ac.r_constraint_name = r_ac.constraint_name JOIN all_cons_columns r_acc ON r_ac.constraint_name = r_acc.constraint_name AND acc.position = r_acc.position WHERE ac.constraint_type = 'R' AND acc.table_name IN (${tables.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
        columns = ['table_name', 'foreign_key_column', 'referenced_table', 'referenced_column'];
    } else if (engine === 'sqlite') {
        sql = tables.map(t => `PRAGMA foreign_key_list('${t}');`).join('\n');
        columns = ['id', 'seq', 'table', 'from', 'to'];
    } else {
        sql = '-- Provide your foreign key details as CSV';
        columns = [];
    }
    return {title: 'Foreign Key Details', sql, columns};
}

function makeCollapsible(title, sql, columns, idx = 0) {
    const id = 'accordion-item-' + title.replace(/\s+/g, '-').toLowerCase();
    const headingId = id + '-heading';
    const collapseId = id + '-collapse';
    const showClass = idx === 0 ? 'show' : '';
    
    // Add special note for EXPLAIN plan visualization
    const visualizationNote = title.includes('EXPLAIN Plan') ? 
        '<div class="alert alert-info mt-2"><i class="fas fa-chart-line me-1"></i><strong>Visualization Feature:</strong> When you upload this CSV and analyze your query, you\'ll get a beautiful flowchart visualization of your execution plan!</div>' : '';
    
    return `
      <div class="accordion-item">
        <h2 class="accordion-header" id="${headingId}">
          <button class="accordion-button ${showClass ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${showClass ? 'true' : 'false'}" aria-controls="${collapseId}">
            ${title}
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${showClass}" aria-labelledby="${headingId}">
          <div class="accordion-body">
            <strong>SQL to run:</strong>
            <pre class="bg-light p-2">${sql}</pre>
            ${columns.length ? `<strong>Expected CSV columns:</strong><ul>${columns.map(c => `<li><code>${c}</code></li>`).join('')}</ul>` : ''}
            ${visualizationNote}
          </div>
        </div>
      </div>
    `;
}

// EXPLAIN Plan Visualization Functions
function ensureD3Loaded(callback) {
    if (typeof d3 !== 'undefined') {
        callback();
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://d3js.org/d3.v7.min.js';
    script.onload = callback;
    script.onerror = () => {
        console.error('Failed to load D3.js');
        document.getElementById('explain_visualization_output').innerHTML = 
            '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Failed to load visualization library. Please refresh the page and try again.</div>';
    };
    document.head.appendChild(script);
}

function generateExplainVisualization() {
    const explainText = document.getElementById('explain_plan_textarea').value.trim();
    const dbEngine = document.getElementById('db_engine_select').value;
    
    if (!explainText) {
        alert('Please provide an EXPLAIN plan first. You can upload a CSV file or paste the EXPLAIN output text.');
        return;
    }
    
    // Show loading state
    const container = document.getElementById('explain_visualization_container');
    const output = document.getElementById('explain_visualization_output');
    container.style.display = 'block';
    output.innerHTML = '<div class="visualization-loading"><div class="spinner"></div><p>Generating visualization...</p></div>';
    
    // Send to backend for processing
    fetch('/generate_explain_visualization', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('input[name="csrf_token"]').value
        },
        body: JSON.stringify({
            explain_plan: explainText,
            db_engine: dbEngine
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Clear output
            output.innerHTML = '';
            
            // Display format detection info
            if (data.detected_format) {
                const formatInfo = document.createElement('div');
                formatInfo.className = 'format-info';
                formatInfo.innerHTML = `<i class="fas fa-info-circle me-2"></i><strong>Format Detected:</strong> ${data.detected_format.toUpperCase()}`;
                output.appendChild(formatInfo);
            }
            
            // Display optimization recommendations if available
            if (data.plan_summary && data.plan_summary.length > 0) {
                const recommendationsDiv = document.createElement('div');
                recommendationsDiv.className = 'recommendations-card';
                recommendationsDiv.innerHTML = `
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-chart-line me-2"></i>Execution Plan Analysis</h6>
                    </div>
                    <div class="card-body">
                        <ul class="list-unstyled mb-0">
                            ${data.plan_summary.map(item => `<li>• ${item}</li>`).join('')}
                        </ul>
                    </div>
                `;
                output.appendChild(recommendationsDiv);
            }
            
            // Display warnings if any
            if (data.plan_warnings && data.plan_warnings.length > 0) {
                const warningsDiv = document.createElement('div');
                warningsDiv.className = 'warnings-alert';
                warningsDiv.innerHTML = `
                    <i class="fas fa-exclamation-triangle me-2"></i><strong>Performance Warnings:</strong>
                    <ul class="mb-0 mt-2">
                        ${data.plan_warnings.map(warning => `<li>${warning}</li>`).join('')}
                    </ul>
                `;
                output.appendChild(warningsDiv);
            }
            
            // Ensure D3 is loaded before rendering
            ensureD3Loaded(() => {
                renderD3Tree(data.json_tree, output);
            });
        } else {
            output.innerHTML = `<div class="visualization-error"><i class="fas fa-exclamation-triangle me-2"></i>Error: ${data.error}</div>`;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        output.innerHTML = `<div class="visualization-error"><i class="fas fa-exclamation-triangle me-2"></i>Error generating visualization. Please try again.</div>`;
    });
}

function renderD3Tree(treeData, container) {
    // Responsive SVG dimensions
    const margin = {top: 30, right: 300, bottom: 50, left: 300};
    const minWidth = 800;
    const minHeight = 800;
    const width = Math.max(container.clientWidth - margin.right - margin.left, minWidth);
    const height = Math.max(container.clientHeight - margin.top - margin.bottom, minHeight);
    container.innerHTML = '';

    // --- Controls Toolbar ---
    const controlsDiv = document.createElement('div');
    controlsDiv.style.display = 'flex';
    controlsDiv.style.justifyContent = 'flex-start';
    controlsDiv.style.gap = '12px';
    controlsDiv.style.marginBottom = '10px';
    controlsDiv.style.flexWrap = 'wrap';
    controlsDiv.style.padding = '10px';
    controlsDiv.style.backgroundColor = '#f8fafc';
    controlsDiv.style.borderRadius = '8px';
    controlsDiv.style.border = '1px solid #e2e8f0';
    
    // Create buttons with proper styling and event prevention
    const buttonData = [
        {id: 'zoom-in-btn', text: '🔍 Zoom In', title: 'Zoom In'},
        {id: 'zoom-out-btn', text: '🔍 Zoom Out', title: 'Zoom Out'},
        {id: 'fit-btn', text: '📐 Fit to Page', title: 'Fit to Page'},
        {id: 'download-png-btn', text: '📷 Download PNG', title: 'Download as PNG'},
        {id: 'download-svg-btn', text: '🖼️ Download SVG', title: 'Download as SVG'}
    ];
    
    buttonData.forEach(btn => {
        const button = document.createElement('button');
        button.id = btn.id;
        button.title = btn.title;
        button.textContent = btn.text;
        button.type = 'button'; // Prevent form submission
        button.style.cssText = `
            padding: 8px 16px;
            font-weight: 600;
            font-size: 14px;
            border: 2px solid #3b82f6;
            border-radius: 6px;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: fit-content;
            white-space: nowrap;
        `;
        
        // Add hover effects
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
        
        // Prevent form submission
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        
        controlsDiv.appendChild(button);
    });
    
    container.appendChild(controlsDiv);

    // --- SVG ---
    const svg = d3.select(container).append("svg")
        .attr("width", width + margin.right + margin.left)
        .attr("height", height + margin.top + margin.bottom)
        .style("overflow", "auto")
        .style("max-width", "100%")
        .style("display", "block")
        .attr("viewBox", `0 0 ${width + margin.right + margin.left} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Zoom Behavior ---
    const zoom = d3.zoom()
        .scaleExtent([0.3, 4])
        .on("zoom", (event) => {
            svg.attr("transform", event.transform);
        });
    d3.select(container).select("svg").call(zoom);

    // --- Zoom Controls ---
    let currentTransform = d3.zoomIdentity;
    d3.select(container).select("svg").on("wheel.zoom", null); // prevent double zoom
    
    // Wait for buttons to be created before attaching handlers
    setTimeout(() => {
        // Zoom In
        const zoomInBtn = document.getElementById('zoom-in-btn');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                currentTransform = currentTransform.scale(1.2);
                d3.select(container).select("svg").transition().duration(300).call(zoom.transform, currentTransform);
            });
        }
        
        // Zoom Out
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                currentTransform = currentTransform.scale(0.8);
                d3.select(container).select("svg").transition().duration(300).call(zoom.transform, currentTransform);
            });
        }
        
        // Fit to Page
        const fitBtn = document.getElementById('fit-btn');
        if (fitBtn) {
            fitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                d3.select(container).select("svg").transition().duration(300).call(zoom.transform, d3.zoomIdentity);
                currentTransform = d3.zoomIdentity;
            });
        }
        
        // Download PNG
        const downloadPngBtn = document.getElementById('download-png-btn');
        if (downloadPngBtn) {
            downloadPngBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                exportToPNG(container.querySelector("svg"));
            });
        }
        
        // Download SVG
        const downloadSvgBtn = document.getElementById('download-svg-btn');
        if (downloadSvgBtn) {
            downloadSvgBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                exportToSVG(container.querySelector("svg"));
            });
        }
    }, 100); // Small delay to ensure buttons are created

    // --- Tree Layout ---
    const root = d3.hierarchy(treeData, d => d.children);
    let maxCost = 0, maxTime = 0, maxBufferReads = 0, performanceHotspots = [];
    root.each(d => {
        if (d.data.cost > maxCost) maxCost = d.data.cost;
        if (d.data.time > maxTime) maxTime = d.data.time;
        if (d.data.buffers && d.data.buffers.shared_read > maxBufferReads) {
            maxBufferReads = d.data.buffers.shared_read;
        }
    });
    const allNodes = root.descendants().filter(d => d.data.cost > 0);
    allNodes.sort((a, b) => b.data.cost - a.data.cost);
    const hotspotCount = Math.max(1, Math.floor(allNodes.length * 0.2));
    performanceHotspots = allNodes.slice(0, hotspotCount).map(d => d.data.cost);
    const colorScale = d3.scaleLinear()
        .domain([0, Math.max(maxCost, maxTime * 100, maxBufferReads * 10)])
        .range(["#10b981", "#f59e0b", "#ef4444"]);
    const tree = d3.tree().size([width, height]).separation((a, b) => (a.parent === b.parent ? 2.0 : 2.5));
    const treeData2 = tree(root);
    const nodes = treeData2.descendants();
    const links = treeData2.links();

    
    // --- Enhanced Flow Lines with Proper Arrows ---
    // Add arrow marker for flow direction
    const arrowMarker = svg.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -10 20 20")
        .attr("refX", 15)
        .attr("refY", 0)
        .attr("markerWidth", 20)
        .attr("markerHeight", 20)
        .attr("orient", "auto");
    
    arrowMarker.append("path")
        .attr("d", "M0,-8L15,0L0,8")
        .attr("fill", "#ef4444")
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 2);
    
    // Create custom link paths with arrows
    svg.selectAll(".link")
        .data(links)
        .enter().append("path")
        .attr("class", "link")
        .attr("d", d => {
            const sourceX = d.source.x;
            const sourceY = d.source.y;
            const targetX = d.target.x;
            const targetY = d.target.y;
            
            // Calculate node dimensions for proper arrow positioning
            const sourceRadius = 60;
            const targetRadius = 60;
            
            // Start from bottom of source node
            const startY = sourceY + sourceRadius + 20;
            
            // End at top of target node with space for arrow
            const endY = targetY - targetRadius - 20;
            
            // Create a smooth curve that clearly shows the flow direction
            const controlY = (startY + endY) / 2;
            
            const path = `M${sourceX},${startY} Q${sourceX},${controlY} ${targetX},${endY}`;
            return path;
        })
        .style("fill", "none")
        .style("stroke", "#ef4444")
        .style("stroke-width", 4)
        .style("stroke-opacity", 1)
        .attr("marker-end", "url(#arrowhead)")
        .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.2))")
        .on("mouseover", function() {
            d3.select(this).style("stroke-width", 6).style("stroke", "#dc2626");
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke-width", 4).style("stroke", "#ef4444");
        });

    // --- Enhanced Node Data with More Metrics ---
    function enhanceNodeData(d) {
        const enhanced = { ...d.data };
        
        // Add estimated vs actual metrics
        enhanced.estimated_rows = d.data.rows;
        enhanced.actual_rows = d.data.actual_rows || d.data.rows;
        enhanced.row_accuracy = enhanced.actual_rows && enhanced.estimated_rows ? 
            Math.abs(enhanced.actual_rows - enhanced.estimated_rows) / enhanced.estimated_rows : 0;
        
        // Add I/O metrics
        enhanced.io_reads = d.data.buffers?.shared_read || 0;
        enhanced.io_hits = d.data.buffers?.shared_hit || 0;
        enhanced.io_writes = d.data.buffers?.shared_written || 0;
        
        // Add CPU and time metrics
        enhanced.cpu_time = d.data.cpu_time || 0;
        enhanced.elapsed_time = d.data.time || 0;
        
        // Add warnings and performance indicators
        enhanced.warnings = [];
        if (enhanced.row_accuracy > 0.5 && enhanced.estimated_rows > 0) enhanced.warnings.push("Row estimate inaccurate");
        if (enhanced.io_reads > 1000) enhanced.warnings.push("High I/O reads");
        if (enhanced.cost > maxCost * 0.8 && maxCost > 0) enhanced.warnings.push("High cost operation");
        if (enhanced.elapsed_time > 100) enhanced.warnings.push("Slow execution");
        
        return enhanced;
    }

    // --- Node shape/color logic ---
    function getNodeShape(operation) {
        if (!operation) return 'circle';
        const op = operation.toLowerCase();
        if (op.includes('join')) return 'rect';
        if (op.includes('sort')) return 'diamond';
        if (op.includes('scan')) return 'ellipse';
        if (op.includes('aggregate')) return 'hex';
        if (op.includes('seek')) return 'ellipse';
        if (op.includes('hash')) return 'rect';
        if (op.includes('filter')) return 'triangle';
        return 'circle';
    }
    function getNodeColor(operation, cost) {
        if (!operation) return colorScale(0);
        const op = operation.toLowerCase();
        if (op.includes('join')) return '#f59e0b';
        if (op.includes('sort')) return '#6366f1';
        if (op.includes('scan')) return '#10b981';
        if (op.includes('aggregate')) return '#a21caf';
        if (op.includes('seek')) return '#0ea5e9';
        if (op.includes('hash')) return '#f43f5e';
        if (op.includes('filter')) return '#fbbf24';
        return colorScale(cost);
    }
    function getTextWidth(text, fontSize = 16, fontWeight = 'bold') {
        const tempSvg = d3.select('body').append('svg').attr('style', 'position:absolute;left:-9999px;top:-9999px');
        const tempText = tempSvg.append('text').attr('font-size', fontSize).attr('font-weight', fontWeight).text(text);
        const width = tempText.node().getComputedTextLength();
        tempSvg.remove();
        return width;
    }
    
    // Find costliest node(s)
    const maxCostNodes = nodes.filter(d => d.data.cost === maxCost && maxCost > 0);
    
    function drawNodeShape(g, d, r) {
        const enhancedData = enhanceNodeData(d);
        const shape = getNodeShape(d.data.operation);
        const opText = d.data.operation || '';
        const metricsText = `Cost: ${d.data.cost} Rows: ${d.data.rows}`;
        const opWidth = getTextWidth(opText, 18, 'bold');
        const metricsWidth = getTextWidth(metricsText, 15, 'normal');
        const minW = 120, minH = 60;
        const maxWidth = Math.max(opWidth, metricsWidth, r * 2, minW) + 36;
        const maxHeight = Math.max(r * 2 + 36, minH);
        const isHot = d.data.cost === maxCost && maxCost > 0;
        const hasWarnings = enhancedData.warnings.length > 0;
        
        // Draw main shape
        if (shape === 'rect') {
            g.append('rect')
                .attr('x', -maxWidth/2)
                .attr('y', -maxHeight/2)
                .attr('width', maxWidth)
                .attr('height', maxHeight)
                .attr('rx', 14)
                .attr('fill', getNodeColor(d.data.operation, d.data.cost))
                .attr('stroke', isHot ? '#ef4444' : (hasWarnings ? '#f59e0b' : '#1f2937'))
                .attr('stroke-width', isHot ? 6 : (hasWarnings ? 4 : 2.5))
                .attr('filter', isHot ? 'drop-shadow(0 0 12px #ef4444)' : (hasWarnings ? 'drop-shadow(0 0 8px #f59e0b)' : null));
        } else if (shape === 'diamond') {
            g.append('polygon')
                .attr('points', `0,-${maxHeight/2} ${maxWidth/2},0 0,${maxHeight/2} -${maxWidth/2},0`)
                .attr('fill', getNodeColor(d.data.operation, d.data.cost))
                .attr('stroke', isHot ? '#ef4444' : (hasWarnings ? '#f59e0b' : '#1f2937'))
                .attr('stroke-width', isHot ? 6 : (hasWarnings ? 4 : 2.5))
                .attr('filter', isHot ? 'drop-shadow(0 0 12px #ef4444)' : (hasWarnings ? 'drop-shadow(0 0 8px #f59e0b)' : null));
        } else if (shape === 'ellipse') {
            g.append('ellipse')
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('rx', maxWidth/2)
                .attr('ry', maxHeight/2.2)
                .attr('fill', getNodeColor(d.data.operation, d.data.cost))
                .attr('stroke', isHot ? '#ef4444' : (hasWarnings ? '#f59e0b' : '#1f2937'))
                .attr('stroke-width', isHot ? 6 : (hasWarnings ? 4 : 2.5))
                .attr('filter', isHot ? 'drop-shadow(0 0 12px #ef4444)' : (hasWarnings ? 'drop-shadow(0 0 8px #f59e0b)' : null));
        } else if (shape === 'hex') {
            const hexPoints = Array.from({length: 6}, (_, i) => {
                const angle = Math.PI / 3 * i;
                return [maxWidth/2 * Math.cos(angle), maxHeight/2.2 * Math.sin(angle)];
            });
            g.append('polygon')
                .attr('points', hexPoints.map(p => p.join(",")).join(' '))
                .attr('fill', getNodeColor(d.data.operation, d.data.cost))
                .attr('stroke', isHot ? '#ef4444' : (hasWarnings ? '#f59e0b' : '#1f2937'))
                .attr('stroke-width', isHot ? 6 : (hasWarnings ? 4 : 2.5))
                .attr('filter', isHot ? 'drop-shadow(0 0 12px #ef4444)' : (hasWarnings ? 'drop-shadow(0 0 8px #f59e0b)' : null));
        } else if (shape === 'triangle') {
            g.append('polygon')
                .attr('points', `0,-${maxHeight/2} ${maxWidth/2},${maxHeight/2} -${maxWidth/2},${maxHeight/2}`)
                .attr('fill', getNodeColor(d.data.operation, d.data.cost))
                .attr('stroke', isHot ? '#ef4444' : (hasWarnings ? '#f59e0b' : '#1f2937'))
                .attr('stroke-width', isHot ? 6 : (hasWarnings ? 4 : 2.5))
                .attr('filter', isHot ? 'drop-shadow(0 0 12px #ef4444)' : (hasWarnings ? 'drop-shadow(0 0 8px #f59e0b)' : null));
        } else {
            g.append('ellipse')
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('rx', maxWidth/2)
                .attr('ry', maxHeight/2.2)
                .attr('fill', getNodeColor(d.data.operation, d.data.cost))
                .attr('stroke', isHot ? '#ef4444' : (hasWarnings ? '#f59e0b' : '#1f2937'))
                .attr('stroke-width', isHot ? 6 : (hasWarnings ? 4 : 2.5))
                .attr('filter', isHot ? 'drop-shadow(0 0 12px #ef4444)' : (hasWarnings ? 'drop-shadow(0 0 8px #f59e0b)' : null));
        }
        
        // HOT badge - positioned to the right of the node to avoid blocking content
        if (isHot) {
            g.append('text')
                .attr('x', maxWidth/2 + 25)
                .attr('y', 0)
                .attr('text-anchor', 'middle')
                .attr('font-size', '1.1em')
                .attr('font-weight', 'bold')
                .attr('fill', '#ef4444')
                .attr('stroke', 'white')
                .attr('stroke-width', 1.5)
                .text('🔥 HOT');
        }
        
        // Warning badge - positioned on the node itself
        if (hasWarnings && !isHot) {
            g.append('text')
                .attr('x', maxWidth/2 - 15)
                .attr('y', -maxHeight/2 + 15)
                .attr('text-anchor', 'middle')
                .attr('font-size', '1.1em')
                .attr('font-weight', 'bold')
                .attr('fill', '#f59e0b')
                .attr('stroke', 'white')
                .attr('stroke-width', 1.5)
                .text('⚠️');
        }
    }

    // --- Draw nodes ---
    const node = svg.selectAll(".node")
        .data(nodes)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .style("cursor", "pointer");

    node.each(function(d) {
        const g = d3.select(this);
        const baseRadius = 36;
        drawNodeShape(g, d, baseRadius);
    });

    // --- Enhanced Node labels and metrics ---
    node.append("text")
        .attr("dy", "-1.2em")
        .attr("text-anchor", "middle")
        .attr("font-weight", 600)
        .attr("font-size", "1.1em")
        .text(d => {
            if (d.data.operation === 'Query Execution Plan') {
                return 'SQL Execution Plan';
            }
            return d.data.operation || 'Operation';
        });

    node.append("text")
        .attr("dy", "0.2em")
        .attr("text-anchor", "middle")
        .attr("font-size", "0.95em")
        .text(d => d.data.logical_op ? d.data.logical_op : '');

    node.append("text")
        .attr("dy", "1.4em")
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9em")
        .text(d => `Cost: ${d.data.cost}`);

    node.append("text")
        .attr("dy", "2.2em")
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9em")
        .text(d => `Rows: ${d.data.rows}`);

    node.append("text")
        .attr("dy", "3.0em")
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9em")
        .text(d => d.data.time ? `Time: ${d.data.time}` : '');

    node.append("text")
        .attr("dy", "3.8em")
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9em")
        .text(d => (d.data.buffers && d.data.buffers.shared_read) ? `I/O: ${d.data.buffers.shared_read}` : '');

    // --- Enhanced Tooltips with Detailed Metrics ---
    node.append("title")
        .text(d => {
            const enhancedData = enhanceNodeData(d);
            let t = `Operation: ${d.data.operation}\n`;
            if (d.data.logical_op) t += `Logical Op: ${d.data.logical_op}\n`;
            t += `Cost: ${d.data.cost}\n`;
            t += `Estimated Rows: ${enhancedData.estimated_rows}\n`;
            if (enhancedData.actual_rows !== enhancedData.estimated_rows) {
                t += `Actual Rows: ${enhancedData.actual_rows}\n`;
                t += `Row Accuracy: ${(enhancedData.row_accuracy * 100).toFixed(1)}% off\n`;
            }
            if (enhancedData.io_reads > 0) t += `I/O Reads: ${enhancedData.io_reads}\n`;
            if (enhancedData.io_hits > 0) t += `I/O Hits: ${enhancedData.io_hits}\n`;
            if (enhancedData.cpu_time > 0) t += `CPU Time: ${enhancedData.cpu_time}ms\n`;
            if (enhancedData.elapsed_time > 0) t += `Elapsed Time: ${enhancedData.elapsed_time}ms\n`;
            if (d.data.node_id) t += `NodeId: ${d.data.node_id}\n`;
            if (d.data.cost === maxCost && maxCost > 0) t += `\n🔥 HOT (Costliest)`;
            if (enhancedData.warnings.length > 0) {
                t += `\n⚠️ Warnings:\n${enhancedData.warnings.join('\n')}`;
            }
            return t;
        });

    // --- Click to Expand Functionality ---
    node.on("click", function(event, d) {
        const enhancedData = enhanceNodeData(d);
        const details = `
            <div style="padding: 15px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 400px;">
                <h4 style="margin: 0 0 10px 0; color: #1f2937;">${d.data.operation}</h4>
                <div style="font-size: 14px; line-height: 1.5;">
                    <p><strong>Cost:</strong> ${d.data.cost}</p>
                    <p><strong>Estimated Rows:</strong> ${enhancedData.estimated_rows}</p>
                    ${enhancedData.actual_rows !== enhancedData.estimated_rows ? 
                        `<p><strong>Actual Rows:</strong> ${enhancedData.actual_rows}</p>
                         <p><strong>Accuracy:</strong> ${(enhancedData.row_accuracy * 100).toFixed(1)}% off</p>` : ''}
                    ${enhancedData.io_reads > 0 ? `<p><strong>I/O Reads:</strong> ${enhancedData.io_reads}</p>` : ''}
                    ${enhancedData.cpu_time > 0 ? `<p><strong>CPU Time:</strong> ${enhancedData.cpu_time}ms</p>` : ''}
                    ${enhancedData.elapsed_time > 0 ? `<p><strong>Elapsed Time:</strong> ${enhancedData.elapsed_time}ms</p>` : ''}
                    ${enhancedData.warnings.length > 0 ? 
                        `<p><strong>⚠️ Warnings:</strong></p><ul style="margin: 5px 0; padding-left: 20px;">
                            ${enhancedData.warnings.map(w => `<li>${w}</li>`).join('')}
                        </ul>` : ''}
                </div>
            </div>
        `;
        
        // Show modal or tooltip with details
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.5); display: flex; align-items: center; 
            justify-content: center; z-index: 10000;
        `;
        modal.innerHTML = details;
        modal.onclick = () => modal.remove();
        document.body.appendChild(modal);
    });
    
    // --- Legend ---
    const legendData = [
        {label: 'Join', shape: 'rect', color: '#f59e0b'},
        {label: 'Sort', shape: 'diamond', color: '#6366f1'},
        {label: 'Scan', shape: 'ellipse', color: '#10b981'},
        {label: 'Aggregate', shape: 'hex', color: '#a21caf'},
        {label: 'Seek', shape: 'ellipse', color: '#0ea5e9'},
        {label: 'Hash', shape: 'rect', color: '#f43f5e'},
        {label: 'Filter', shape: 'triangle', color: '#fbbf24'},
        {label: 'Other', shape: 'circle', color: '#d1d5db'}
    ];
    const legend = d3.select(container).select("svg")
        .append("g")
        .attr("class", "legend")
        .attr("transform", `translate(40, 40)`);
    legend.selectAll(".legend-shape")
        .data(legendData)
        .enter().append("g")
        .attr("class", "legend-shape")
        .attr("transform", (d, i) => `translate(0,${i * 32})`)
        .each(function(d) {
            const g = d3.select(this);
            const r = 14;
            if (d.shape === 'rect') {
                g.append('rect').attr('x', -r).attr('y', -r).attr('width', r*2).attr('height', r*2).attr('rx', 6).attr('fill', d.color).attr('stroke', '#1f2937').attr('stroke-width', 2);
            } else if (d.shape === 'diamond') {
                g.append('polygon').attr('points', `0,-${r} ${r},0 0,${r} -${r},0`).attr('fill', d.color).attr('stroke', '#1f2937').attr('stroke-width', 2);
            } else if (d.shape === 'ellipse') {
                g.append('ellipse').attr('cx', 0).attr('cy', 0).attr('rx', r*1.2).attr('ry', r*0.8).attr('fill', d.color).attr('stroke', '#1f2937').attr('stroke-width', 2);
            } else if (d.shape === 'hex') {
                const hexPoints = Array.from({length: 6}, (_, i) => {
                    const angle = Math.PI / 3 * i;
                    return [r * Math.cos(angle), r * Math.sin(angle)];
                });
                g.append('polygon').attr('points', hexPoints.map(p => p.join(",")).join(' ')).attr('fill', d.color).attr('stroke', '#1f2937').attr('stroke-width', 2);
            } else if (d.shape === 'triangle') {
                g.append('polygon').attr('points', `0,-${r} ${r},${r} -${r},${r}`).attr('fill', d.color).attr('stroke', '#1f2937').attr('stroke-width', 2);
            } else {
                g.append('circle').attr('r', r).attr('fill', d.color).attr('stroke', '#1f2937').attr('stroke-width', 2);
            }
            g.append('text').attr('x', 28).attr('y', 6).attr('font-size', '1em').text(d.label);
        });
    // Cost color gradient legend
    const gradLegend = d3.select(container).select("svg")
        .append("g")
        .attr("class", "cost-legend")
        .attr("transform", `translate(40, ${legendData.length * 32 + 60})`);
    gradLegend.append('text').attr('x', 0).attr('y', 0).attr('font-size', '1em').text('Cost Gradient:');
    const grad = gradLegend.append('defs').append('linearGradient')
        .attr('id', 'cost-gradient')
        .attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981');
    grad.append('stop').attr('offset', '50%').attr('stop-color', '#f59e0b');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444');
    gradLegend.append('rect')
        .attr('x', 0).attr('y', 10)
        .attr('width', 120)
        .attr('height', 16)
        .attr('fill', 'url(#cost-gradient)');
    gradLegend.append('text').attr('x', 0).attr('y', 38).attr('font-size', '0.9em').text('Low');
    gradLegend.append('text').attr('x', 100).attr('y', 38).attr('font-size', '0.9em').text('High');
    
    // --- Performance Summary ---
    const summary = document.createElement('div');
    summary.style.marginTop = '20px';
    summary.style.padding = '15px';
    summary.style.background = 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)';
    summary.style.borderRadius = '10px';
    summary.style.border = '2px solid #cbd5e1';
    summary.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    summary.innerHTML = `
        <h6 style="margin:0 0 15px 0;color:#1f2937;font-weight:700;text-align:center;font-size:16px;">📈 Performance Summary</h6>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;">
            <div style="font-size:13px;padding:8px;background:rgba(59,130,246,0.1);border-radius:6px;border-left:4px solid #3b82f6;"><strong>💰 Max Cost:</strong> ${maxCost.toFixed(2)}</div>
            <div style="font-size:13px;padding:8px;background:rgba(16,185,129,0.1);border-radius:6px;border-left:4px solid #10b981;"><strong>⏱️ Max Time:</strong> ${maxTime.toFixed(2)}ms</div>
            <div style="font-size:13px;padding:8px;background:rgba(245,158,11,0.1);border-radius:6px;border-left:4px solid #f59e0b;"><strong>💾 Max I/O:</strong> ${maxBufferReads.toLocaleString()} reads</div>
            <div style="font-size:13px;padding:8px;background:rgba(239,68,68,0.1);border-radius:6px;border-left:4px solid #ef4444;"><strong>🔥 Hotspots:</strong> ${maxCostNodes.length} identified</div>
        </div>
    `;
    container.appendChild(summary);

    // --- Export Functions ---
    function exportToPNG(svgNode) {
        // Get the full SVG dimensions including all content
        const bbox = svgNode.getBBox();
        const extraTop = 60; // extra margin for legend/top
        const extraBottom = 200; // extra margin for performance summary
        const fullWidth = bbox.width + margin.left + margin.right;
        const fullHeight = bbox.height + margin.top + margin.bottom + extraTop + extraBottom;
        
        // Create a temporary SVG with the full dimensions
        const tempSvg = svgNode.cloneNode(true);
        tempSvg.setAttribute('width', fullWidth);
        tempSvg.setAttribute('height', fullHeight);
        tempSvg.setAttribute('viewBox', `0 0 ${fullWidth} ${fullHeight}`);
        tempSvg.setAttribute('style', `background:white`);
        
        // Move all content down by extraTop
        const g = tempSvg.querySelector('g');
        if (g) {
            const oldTransform = g.getAttribute('transform') || '';
            g.setAttribute('transform', `translate(${margin.left},${margin.top + extraTop})`);
        }
        
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(tempSvg);
        
        const canvas = document.createElement("canvas");
        canvas.width = fullWidth;
        canvas.height = fullHeight;
        const ctx = canvas.getContext("2d");
        const img = new Image();
        
        img.onload = () => {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const png = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = png;
            a.download = "sql_execution_plan.png";
            a.click();
        };
        
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
    }
    
    function exportToSVG(svgNode) {
        // Get the full SVG dimensions including all content
        const bbox = svgNode.getBBox();
        const extraTop = 60;
        const extraBottom = 200; // extra margin for performance summary
        const fullWidth = bbox.width + margin.left + margin.right;
        const fullHeight = bbox.height + margin.top + margin.bottom + extraTop + extraBottom;
        
        // Create a temporary SVG with the full dimensions
        const tempSvg = svgNode.cloneNode(true);
        tempSvg.setAttribute('width', fullWidth);
        tempSvg.setAttribute('height', fullHeight);
        tempSvg.setAttribute('viewBox', `0 0 ${fullWidth} ${fullHeight}`);
        tempSvg.setAttribute('style', `background:white`);
        
        // Move all content down by extraTop
        const g = tempSvg.querySelector('g');
        if (g) {
            const oldTransform = g.getAttribute('transform') || '';
            g.setAttribute('transform', `translate(${margin.left},${margin.top + extraTop})`);
        }
        
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(tempSvg);
        const blob = new Blob([svgStr], {type: "image/svg+xml"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sql_execution_plan.svg";
        a.click();
        URL.revokeObjectURL(url);
    }
}

function ensureMermaidLoaded(callback) {
    if (typeof mermaid !== 'undefined' && mermaid.initialize) {
        // Mermaid is already loaded, just initialize and callback
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            flowchart: {
                useMaxWidth: false,
                htmlLabels: true
            }
        });
        callback();
    } else {
        // Load Mermaid dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@8.14.0/dist/mermaid.min.js?v=' + Date.now();
        script.onload = () => {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                flowchart: {
                    useMaxWidth: false,
                    htmlLabels: true
                }
            });
            callback();
        };
        script.onerror = () => {
            console.error('Failed to load Mermaid.js');
            document.getElementById('explain_visualization_output').innerHTML = 
                '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Failed to load visualization library. Please refresh the page and try again.</div>';
        };
        document.head.appendChild(script);
    }
}

function renderVisualization(mermaidCode) {
    const output = document.getElementById('explain_visualization_output');
    
    if (!output) {
        console.error('explain_visualization_output container not found');
        return;
    }
    
    // Create a unique ID for the diagram
    const diagramId = 'explain-diagram-' + Date.now();
    console.log('Generated diagram ID:', diagramId);
    
    // Clear the output and create a new container
    output.innerHTML = '';
    
    // Create the diagram container
    const diagramContainer = document.createElement('div');
    diagramContainer.id = diagramId;
    diagramContainer.className = 'mermaid';
    output.appendChild(diagramContainer);
    
    console.log('Diagram container created successfully');
    
    // Store reference to the container
    let containerRef = diagramContainer;
    
    // Use a more reliable rendering approach
    try {
        console.log('Calling mermaid.render...');
        
        // Try the promise-based approach first
        if (typeof mermaid.render === 'function') {
            const renderResult = mermaid.render(diagramId, mermaidCode);
            
            if (renderResult && typeof renderResult.then === 'function') {
                // Promise-based API
                console.log('Using Promise API');
                renderResult.then(({svg}) => {
                    console.log('Promise resolved, setting SVG...');
                    // Use stored reference instead of searching by ID
                    if (containerRef && containerRef.parentNode) {
                        containerRef.innerHTML = svg;
                        console.log('SVG set successfully');
                    } else {
                        console.error('Container reference lost');
                        showFallbackUI(mermaidCode, output);
                    }
                }).catch(error => {
                    console.error('Mermaid rendering error:', error);
                    // Try direct SVG creation as final fallback
                    try {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = `<svg width="100%" height="400" xmlns="http://www.w3.org/2000/svg">
                            <text x="10" y="30" font-family="Arial" font-size="14" fill="red">Rendering failed: ${error.message}</text>
                            <text x="10" y="60" font-family="Arial" font-size="12" fill="blue">Please use Mermaid Live Editor</text>
                        </svg>`;
                        const svgElement = tempDiv.firstElementChild;
                        if (svgElement) {
                            output.appendChild(svgElement);
                            console.log('Error SVG created and appended');
                        } else {
                            showFallbackUI(mermaidCode, output);
                        }
                    } catch (finalError) {
                        console.error('Final fallback failed:', finalError);
                        showFallbackUI(mermaidCode, output);
                    }
                });
            } else if (renderResult && renderResult.svg) {
                // Synchronous API with SVG
                console.log('Using Synchronous API with SVG');
                if (containerRef && containerRef.parentNode) {
                    containerRef.innerHTML = renderResult.svg;
                    console.log('SVG set successfully');
                } else {
                    console.error('Container reference lost');
                    showFallbackUI(mermaidCode, output);
                }
            } else {
                // Fallback: try to render directly
                console.log('Using fallback rendering approach');
                try {
                    mermaid.parse(mermaidCode);
                    const svg = mermaid.render(diagramId, mermaidCode);
                    
                    // Use stored reference immediately
                    if (containerRef && containerRef.parentNode) {
                        containerRef.innerHTML = svg;
                        console.log('Fallback SVG set successfully');
                    } else {
                        console.error('Container reference lost in fallback');
                        // Try to create SVG element directly
                        try {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = svg;
                            const svgElement = tempDiv.firstElementChild;
                            if (svgElement) {
                                output.appendChild(svgElement);
                                console.log('SVG element created and appended directly');
                            } else {
                                throw new Error('No SVG element found');
                            }
                        } catch (directError) {
                            console.error('Direct SVG creation failed:', directError);
                            showFallbackUI(mermaidCode, output);
                        }
                    }
                } catch (fallbackError) {
                    console.error('Fallback rendering failed:', fallbackError);
                    showFallbackUI(mermaidCode, output);
                }
            }
        } else {
            throw new Error('mermaid.render is not available');
        }
    } catch (error) {
        console.error('Error in renderVisualization:', error);
        showFallbackUI(mermaidCode, output);
    }
}

function showFallbackUI(mermaidCode, container) {
    container.innerHTML = `
        <div class="alert alert-info">
            <h6><i class="fas fa-info-circle me-2"></i>Visualization Preview</h6>
            <p>The diagram couldn't be rendered automatically, but here's the Mermaid code:</p>
            <pre class="bg-light p-3 rounded">${mermaidCode}</pre>
            <p class="mb-0"><small>You can copy this code and paste it into <a href="https://mermaid.live" target="_blank">Mermaid Live Editor</a> to view the diagram.</small></p>
        </div>
    `;
}

function downloadVisualization() {
    const svg = document.querySelector('#explain_visualization_output svg');
    if (!svg) {
        alert('No visualization to download. Please generate one first.');
        return;
    }
    
    try {
        // Get SVG dimensions
        const svgRect = svg.getBoundingClientRect();
        const width = svgRect.width || 800;
        const height = svgRect.height || 600;
        
        // Create canvas with proper dimensions
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        // Set white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        
        // Convert SVG to data URL
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        
        img.onload = function() {
            try {
                // Draw the image on canvas
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob and download
                canvas.toBlob(function(blob) {
                    if (blob) {
                        const downloadUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = 'explain_plan_visualization.png';
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(downloadUrl);
                        console.log('PNG download successful');
                    } else {
                        throw new Error('Failed to create blob');
                    }
                }, 'image/png', 0.95);
                
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Canvas error:', error);
                downloadAsSVG(svgData);
            }
        };
        
        img.onerror = function() {
            console.error('Image load error, falling back to SVG');
            downloadAsSVG(svgData);
            URL.revokeObjectURL(url);
        };
        
        img.src = url;
        
    } catch (error) {
        console.error('Download error:', error);
        // Final fallback: try to download as SVG
        try {
            const svgData = new XMLSerializer().serializeToString(svg);
            downloadAsSVG(svgData);
        } catch (finalError) {
            console.error('Final fallback failed:', finalError);
            alert('Download failed. Please try again or use the copy function.');
        }
    }
}

function downloadAsSVG(svgData) {
    try {
        const blob = new Blob([svgData], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'explain_plan_visualization.svg';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('SVG download successful');
    } catch (error) {
        console.error('SVG download failed:', error);
        alert('Download failed. Please try again or use the copy function.');
    }
}

function copyVisualizationCode() {
    // Try to get the Mermaid code from the current visualization
    let mermaidCode = '';
    
    // First, try to get from the stored code (if available)
    if (window.currentMermaidCode) {
        mermaidCode = window.currentMermaidCode;
    } else {
        // Try to get from the mermaid element
        const mermaidElement = document.querySelector('#explain_visualization_output .mermaid');
        if (mermaidElement) {
            mermaidCode = mermaidElement.getAttribute('data-mermaid') || mermaidElement.textContent;
        }
    }
    
    if (!mermaidCode) {
        alert('No visualization code to copy. Please generate one first.');
        return;
    }
    
    // Try to copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(mermaidCode).then(() => {
            showCopySuccess();
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopy(mermaidCode);
        });
    } else {
        fallbackCopy(mermaidCode);
    }
}

function showCopySuccess() {
    // Find the copy button and show success message
    const copyButton = document.querySelector('button[onclick="copyVisualizationCode()"]');
    if (copyButton) {
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
        copyButton.classList.remove('btn-outline-secondary');
        copyButton.classList.add('btn-success');
        
        setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.classList.remove('btn-success');
            copyButton.classList.add('btn-outline-secondary');
        }, 2000);
    } else {
        alert('Mermaid code copied to clipboard!');
    }
}

function fallbackCopy(text) {
    // Fallback copy method
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showCopySuccess();
    } catch (err) {
        console.error('Fallback copy failed: ', err);
        alert('Failed to copy to clipboard. Please select and copy manually:\n\n' + text);
    }
    
    document.body.removeChild(textArea);
}
