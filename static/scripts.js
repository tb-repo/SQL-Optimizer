// Reserved words should be loaded prior from wordlist.js

// Initialize DOM elements when they're available
let cell_input, cell_output, textarea;

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
    console.log('generateExplainVisualization called');
    
    // Check if we're on the results page or input page
    const isResultsPage = window.location.pathname.includes('/result') || document.getElementById('static_explain_visualization_output');
    console.log('isResultsPage:', isResultsPage);
    
    let explainText, dbEngine;
    
    if (isResultsPage) {
        // On results page - use backend-provided data if available
        if (window._explainPlanData && window._dbEngine) {
            explainText = window._explainPlanData;
            dbEngine = window._dbEngine;
            console.log('Using window._explainPlanData and window._dbEngine');
        } else {
            // Fallback to sessionStorage
            explainText = sessionStorage.getItem('explain_plan_text') || '';
            dbEngine = sessionStorage.getItem('db_engine') || 'postgresql';
            console.log('Using sessionStorage data');
        }
        console.log('Results page data:', {
            explainText: explainText ? explainText.substring(0, 100) + '...' : null,
            dbEngine: dbEngine
        });
        if (!explainText) {
            console.log('No EXPLAIN plan data available for automatic visualization');
            return;
        }
    } else {
        // On input page - get from form elements
        explainText = document.getElementById('explain_plan_textarea').value.trim();
        dbEngine = document.getElementById('db_engine_select').value;
        console.log('Input page data:', {
            explainText: explainText ? explainText.substring(0, 100) + '...' : null,
            dbEngine: dbEngine
        });
        if (!explainText) {
            alert('Please provide an EXPLAIN plan first. You can upload a CSV file or paste the EXPLAIN output text.');
            return;
        }
    }
    
    // Show loading state
    const container = document.getElementById('explain_visualization_container');
    const output = document.getElementById('explain_visualization_output');
    
    if (container) {
        container.style.display = 'block';
    }
    
    if (output) {
        output.innerHTML = '<div class="visualization-loading"><div class="spinner"></div><p>Generating visualization...</p></div>';
    }
    
    // Send to backend for processing
    fetch('/generate_explain_visualization', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('input[name="csrf_token"]')?.value || ''
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
            if (output) {
                output.innerHTML = '';
            }
            
            // Display format detection info
            if (data.detected_format) {
                const formatInfo = document.createElement('div');
                formatInfo.className = 'format-info';
                formatInfo.innerHTML = `<i class="fas fa-info-circle me-2"></i><strong>Format Detected:</strong> ${data.detected_format.toUpperCase()}`;
                if (output) output.appendChild(formatInfo);
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
                if (output) output.appendChild(recommendationsDiv);
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
                if (output) output.appendChild(warningsDiv);
            }
            
            // Display comprehensive statistics if available (similar to explain.depesz.com)
            if (data.plan_statistics && Object.keys(data.plan_statistics).length > 0) {
                const stats = data.plan_statistics;
                
                // I/O Statistics
                if (stats.io_stats && Object.keys(stats.io_stats).length > 0) {
                    const ioStatsDiv = document.createElement('div');
                    ioStatsDiv.className = 'stats-card';
                    ioStatsDiv.innerHTML = `
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-hdd me-2"></i>I/O Statistics</h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                ${stats.io_stats.total_io_mb ? `
                                    <div class="col-md-3 mb-2">
                                        <small class="text-muted">Total I/O (MB)</small>
                                        <div class="h6 mb-0">${stats.io_stats.total_io_mb}</div>
                                    </div>
                                ` : ''}
                                ${stats.io_stats.io_throughput_mbps ? `
                                    <div class="col-md-3 mb-2">
                                        <small class="text-muted">I/O Throughput (MB/s)</small>
                                        <div class="h6 mb-0">${stats.io_stats.io_throughput_mbps}</div>
                                    </div>
                                ` : ''}
                                ${stats.io_stats.total_blocks_accessed ? `
                                    <div class="col-md-3 mb-2">
                                        <small class="text-muted">Blocks Accessed</small>
                                        <div class="h6 mb-0">${stats.io_stats.total_blocks_accessed.toLocaleString()}</div>
                                    </div>
                                ` : ''}
                                ${stats.io_stats.io_efficiency ? `
                                    <div class="col-md-3 mb-2">
                                        <small class="text-muted">I/O Efficiency (%)</small>
                                        <div class="h6 mb-0">${stats.io_stats.io_efficiency}%</div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                    if (output) output.appendChild(ioStatsDiv);
                }
                
                // Node Type Statistics
                if (stats.node_type_stats && stats.node_type_stats.length > 0) {
                    const nodeStatsDiv = document.createElement('div');
                    nodeStatsDiv.className = 'stats-card';
                    nodeStatsDiv.innerHTML = `
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-sitemap me-2"></i>Node Type Statistics</h6>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Node Type</th>
                                            <th>Count</th>
                                            <th>Total Time (ms)</th>
                                            <th>Avg Time (ms)</th>
                                            <th>Cost %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${stats.node_type_stats.map(node => `
                                            <tr>
                                                <td>${node.node_type}</td>
                                                <td>${node.count}</td>
                                                <td>${node.total_time_ms}</td>
                                                <td>${node.avg_time_ms}</td>
                                                <td>${node.cost_percentage}%</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                    if (output) output.appendChild(nodeStatsDiv);
                }
                
                // Table Statistics
                if (stats.table_stats && stats.table_stats.length > 0) {
                    const tableStatsDiv = document.createElement('div');
                    tableStatsDiv.className = 'stats-card';
                    tableStatsDiv.innerHTML = `
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-table me-2"></i>Table Statistics</h6>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Table</th>
                                            <th>Scans</th>
                                            <th>Rows Scanned</th>
                                            <th>Avg Time (ms)</th>
                                            <th>Scan Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${stats.table_stats.map(table => `
                                            <tr>
                                                <td>${table.table_name}</td>
                                                <td>${table.scan_count}</td>
                                                <td>${table.rows_scanned.toLocaleString()}</td>
                                                <td>${table.avg_time_per_scan}</td>
                                                <td>${table.scan_efficiency}%</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                    if (output) output.appendChild(tableStatsDiv);
                }
            }
            
            // Render the D3.js visualization
            if (data.json_tree) {
                // Create visualization container
                const vizContainer = document.createElement('div');
                vizContainer.className = 'explain-visualization-container';
                vizContainer.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="mb-0"><i class="fas fa-project-diagram me-2"></i>Execution Plan Visualization</h6>
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-outline-secondary" onclick="toggleMetrics()">
                                <i class="fas fa-chart-bar"></i> Toggle Metrics
                            </button>
                            <button type="button" class="btn btn-outline-secondary" onclick="resetZoom()">
                                <i class="fas fa-search"></i> Reset Zoom
                            </button>
                            <button type="button" class="btn btn-outline-secondary" onclick="exportToPNG(this.closest('.explain-visualization-container'))">
                                <i class="fas fa-download"></i> Export PNG
                            </button>
                        </div>
                    </div>
                    <div id="d3-visualization" style="width: 100%; height: 600px; border: 1px solid #e5e7eb; border-radius: 8px; background: white;"></div>
                `;
                if (output) output.appendChild(vizContainer);
                
                // Ensure D3.js is loaded and render the visualization
                ensureD3Loaded(() => {
                    renderD3Tree(data.json_tree, document.getElementById('d3-visualization'));
                });
            }
        } else {
            console.error('Error generating visualization:', data.error);
            if (output) {
                output.innerHTML = `<div class="visualization-error"><i class="fas fa-exclamation-triangle me-2"></i>${data.error}</div>`;
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        if (output) {
            output.innerHTML = `<div class="visualization-error"><i class="fas fa-exclamation-triangle me-2"></i>Error generating visualization. Please try again.</div>`;
        }
    });
}

        function renderDetailedTree(treeData, container) {
            console.log("renderDetailedTree called with:", {treeData, container});
            
            // Calculate plan complexity to adjust spacing dynamically
            const planComplexity = calculatePlanComplexity(treeData);
            console.log("Detailed tree plan complexity:", planComplexity);
            
            // Set dimensions with dynamic spacing based on complexity
            const baseMargin = {top: 80, right: 450, bottom: 120, left: 450};
            const complexityMultiplier = Math.max(1, planComplexity / 15);
            
            const margin = {
                top: baseMargin.top * complexityMultiplier,
                right: baseMargin.right * complexityMultiplier,
                bottom: baseMargin.bottom * complexityMultiplier,
                left: baseMargin.left * complexityMultiplier
            };
    
            const width = Math.max(container.clientWidth - margin.right - margin.left, 1400);
            const height = Math.max(1200 - margin.top - margin.bottom, 800);
            
            console.log("Dimensions calculated:", {width, height, margin});

            // Clear container
            container.innerHTML = '';
            console.log("Container cleared");

            // Create main visualization container with proper containment
            const vizContainer = d3.select(container).append("div")
                .style("position", "relative")
                .style("width", "100%")
                .style("height", "100%")
                .style("border-radius", "8px")
                .style("background", "#f0f8ff") // Light blue background to make it visible
                .style("border", "2px solid #e5e7eb")
                .style("overflow", "hidden"); // FIX: Add overflow hidden to prevent dragging outside
            
            console.log("Viz container created");

            // Create SVG with much larger dimensions to accommodate text
            const svg = vizContainer.append("svg")
                .attr("width", width + margin.right + margin.left)
                .attr("height", height + margin.top + margin.bottom)
                .style("overflow", "visible");
            
            // Create the main content group that will be transformed by zoom
            const contentGroup = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);
            
            console.log("SVG and content group created");

            // FIXED: Improved zoom implementation with better centering and drag behavior
            const zoom = d3.zoom()
                .scaleExtent([0.2, 4]) // Increased max zoom for better visibility
                .translateExtent([[-width * 3, -height * 3], [width * 4, height * 4]]) // Much larger drag area
                .on("zoom", (event) => {
                    // Apply transform with proper margins and better centering
                    const transform = event.transform;
                    contentGroup.attr("transform", `translate(${margin.left},${margin.top}) scale(${transform.k}) translate(${transform.x},${transform.y})`);
                });

            // Apply zoom to the SVG
            svg.call(zoom);
            
            // Store zoom reference for reset function
            svg.attr("data-zoom", zoom);
            
            // Set initial cursor for better UX
            vizContainer.style("cursor", "grab");
            
            console.log("Zoom behavior added");

            // Use the tree data directly from backend (actual execution flow)
            const root = d3.hierarchy(treeData, d => d.children);
            console.log("Hierarchy created:", root);
            
            // Calculate performance metrics for color coding
            let maxCost = 0;
            let maxTime = 0;
            let maxBufferReads = 0;
            let performanceHotspots = [];
            
            // Calculate performance metrics for color coding
            root.each(d => {
                if (d.data.cost > maxCost) maxCost = d.data.cost;
                if (d.data.time > maxTime) maxTime = d.data.time;
                if (d.data.buffers && d.data.buffers.shared_read > maxBufferReads) {
                    maxBufferReads = d.data.buffers.shared_read;
                }
            });
            
            console.log("Performance metrics calculated:", {maxCost, maxTime, maxBufferReads});
            
            // Ensure we have minimum values for color scale calculation
            if (maxCost === 0) maxCost = 1;
            if (maxTime === 0) maxTime = 1;
            if (maxBufferReads === 0) maxBufferReads = 1;
            
            // Identify performance hotspots (top 20% by cost)
            const allNodes = root.descendants().filter(d => d.data.cost > 0);
            allNodes.sort((a, b) => b.data.cost - a.data.cost);
            const hotspotCount = Math.max(1, Math.floor(allNodes.length * 0.2));
            performanceHotspots = allNodes.slice(0, hotspotCount).map(d => d.data.cost);
            
            // Enhanced color scale with more vibrant colors
            const colorDomain = Math.max(maxCost, maxTime * 100, maxBufferReads * 10);

            const colorScale = d3.scaleLinear()
                .domain([0, colorDomain])
                .range(["#10b981", "#f59e0b", "#ef4444"]); // Green -> Orange -> Red

            // IMPROVED: Increased separation and better spacing for complex plans
            const baseSeparation = 5.0; // Increased from 3.5
            const separationMultiplier = Math.max(1.2, planComplexity / 10); // Increased multiplier
            
            // IMPROVED: Better tree layout with increased spacing
            const tree = d3.tree().size([width, height]).separation((a, b) => {
                // Increased separation to prevent overlaps
                const separation = baseSeparation * separationMultiplier;
                return (a.parent === b.parent ? separation : separation * 1.5);
            });

            // Assigns the data to a hierarchy
            const treeData2 = tree(root);
            console.log("Tree layout applied:", treeData2);

            // FIXED: Better centering calculation for all plan sizes
            const treeBounds = treeData2.descendants().reduce((bounds, d) => {
                bounds.x0 = Math.min(bounds.x0, d.x);
                bounds.x1 = Math.max(bounds.x1, d.x);
                bounds.y0 = Math.min(bounds.y0, d.y);
                bounds.y1 = Math.max(bounds.y1, d.y);
                return bounds;
            }, {x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity});

            // FIXED: Better centering with proper scaling and positioning
            const treeWidth = treeBounds.x1 - treeBounds.x0;
            const treeHeight = treeBounds.y1 - treeBounds.y0;
            
            // Calculate scale to fit the tree in the container with margins
            const availableWidth = width - margin.left - margin.right;
            const availableHeight = height - margin.top - margin.bottom;
            const scaleX = availableWidth / Math.max(treeWidth, 1);
            const scaleY = availableHeight / Math.max(treeHeight, 1);
            const scale = Math.min(scaleX, scaleY, 0.9); // Increased scale for better visibility
            
            // FIXED: Better centering calculation to prevent right-side orientation
            const centerX = (width - treeWidth * scale) / 2;
            const centerY = (height - treeHeight * scale) / 2;

            // Apply scaling and centering transform to all nodes
            treeData2.descendants().forEach(d => {
                d.x = (d.x - treeBounds.x0) * scale + centerX;
                d.y = (d.y - treeBounds.y0) * scale + centerY;
            });
            
            console.log("Tree bounds and centering applied");

            // Compute the new tree layout
            const nodes = treeData2.descendants();
            const links = treeData2.links();
            
            console.log("Nodes and links computed:", {nodesCount: nodes.length, linksCount: links.length});

            // Declare the links with enhanced styling
            const link = svg.selectAll(".link")
                .data(links)
                .enter().append("path")
                .attr("class", "link")
                .attr("d", d3.linkVertical()
                    .x(d => d.x)
                    .y(d => d.y))
                .style("fill", "none")
                .style("stroke", "#3b82f6")
                .style("stroke-width", 2.5)
                .style("stroke-opacity", 0.8)
                .style("z-index", "1");
            
            console.log("Links created");

            // Declare the nodes
            const node = svg.selectAll(".node")
                .data(nodes)
                .enter().append("g")
                .attr("class", "node")
                .attr("transform", d => `translate(${d.x},${d.y})`)
                .style("z-index", "10");
            
            console.log("Nodes created");

            // FIX: Add function to detect scan operations that might need indexes
            function isScanOperation(operation) {
                const scanKeywords = [
                    'TABLE ACCESS FULL', 'SEQUENTIAL SCAN', 'TABLE SCAN', 
                    'INDEX SCAN', 'BITMAP INDEX SCAN', 'INDEX FAST FULL SCAN',
                    'CLUSTERED INDEX SCAN', 'NONCLUSTERED INDEX SCAN',
                    'TABLE ACCESS BY INDEX ROWID', 'INDEX RANGE SCAN'
                ];
                return scanKeywords.some(keyword => 
                    operation.toUpperCase().includes(keyword.toUpperCase())
                );
            }

            // FIX: Add function to detect full table scans specifically
            function isFullTableScan(operation) {
                const fullScanKeywords = [
                    'TABLE ACCESS FULL', 'SEQUENTIAL SCAN', 'TABLE SCAN'
                ];
                return fullScanKeywords.some(keyword => 
                    operation.toUpperCase().includes(keyword.toUpperCase())
                );
            }

            // Add the circles for the nodes with enhanced styling and sizing
            node.append("circle")
                .attr("r", d => {
                    // Larger circles for performance hotspots and more dynamic sizing
                    const baseRadius = 22;
                    if (performanceHotspots.includes(d.data.cost)) {
                        return baseRadius + 10;
                    }
                    if (d.data.cost > maxCost * 0.5) {
                        return baseRadius + 6;
                    }
                    return baseRadius;
                })
                .style("fill", d => {
                    // Enhanced multi-factor color coding
                    const costFactor = d.data.cost / maxCost;
                    const timeFactor = d.data.time / maxTime;
                    const bufferFactor = d.data.buffers && d.data.buffers.shared_read ? d.data.buffers.shared_read / maxBufferReads : 0;
                    
                    // Ensure we have valid factors
                    const validCostFactor = isNaN(costFactor) ? 0 : costFactor;
                    const validTimeFactor = isNaN(timeFactor) ? 0 : timeFactor;
                    const validBufferFactor = isNaN(bufferFactor) ? 0 : bufferFactor;
                    
                    const totalFactor = Math.max(validCostFactor, validTimeFactor, validBufferFactor);
                    const colorValue = colorScale(totalFactor * colorDomain);
                    
                    return colorValue;
                })
                .style("stroke", d => {
                    // FIX: Add special highlighting for scan operations
                    if (isFullTableScan(d.data.operation)) {
                        return "#dc2626"; // Red border for full table scans
                    }
                    if (isScanOperation(d.data.operation)) {
                        return "#f59e0b"; // Orange border for other scans
                    }
                    // Enhanced stroke styling
                    if (performanceHotspots.includes(d.data.cost)) {
                        return "#1f2937";
                    }
                    return d.data.cost === maxCost ? "#1f2937" : "#ffffff";
                })
                .style("stroke-width", d => {
                    // FIX: Thicker border for scan operations
                    if (isScanOperation(d.data.operation)) {
                        return 4;
                    }
                    if (performanceHotspots.includes(d.data.cost)) {
                        return 4;
                    }
                    return d.data.cost === maxCost ? 3 : 2.5;
                })
                .style("stroke-dasharray", d => {
                    // FIX: Special pattern for full table scans
                    if (isFullTableScan(d.data.operation)) {
                        return "8,4"; // Dashed pattern for full scans
                    }
                    // Dashed border for I/O heavy operations
                    if (d.data.buffers && d.data.buffers.shared_read > 0) {
                        return "6,6";
                    }
                    return "none";
                })
                .style("filter", d => {
                    // FIX: Add glow effect for scan operations
                    if (isFullTableScan(d.data.operation)) {
                        return "drop-shadow(0 0 8px rgba(220, 38, 38, 0.6))"; // Red glow for full scans
                    }
                    if (isScanOperation(d.data.operation)) {
                        return "drop-shadow(0 0 6px rgba(245, 158, 11, 0.5))"; // Orange glow for scans
                    }
                    // Add shadow for hotspots
                    if (performanceHotspots.includes(d.data.cost)) {
                        return "drop-shadow(0 4px 8px rgba(0,0,0,0.3))";
                    }
                    return "drop-shadow(0 2px 4px rgba(0,0,0,0.1))";
                })
                .style("z-index", "5");

            // FIXED: Advanced text positioning with collision detection and aggressive spacing
            function calculateTextPosition(d, textType) {
                const baseOffset = 150 * complexityMultiplier; // Much larger base offset
                const verticalSpacing = {
                    'operation': 0,
                    'metrics': 8.0 * complexityMultiplier, // Much larger spacing
                    'indicators': 10.0 * complexityMultiplier // Much larger spacing
                };
                
                let xOffset = baseOffset;
                let yOffset = verticalSpacing[textType] || 0;
                
                // FIXED: Advanced side determination with better distribution
                let isLeftSide = false;
                
                // For nodes with siblings, place text on opposite sides to prevent overlaps
                if (d.parent && d.parent.children) {
                    const siblings = d.parent.children;
                    const siblingIndex = siblings.indexOf(d);
                    const totalSiblings = siblings.length;
                    
                    // FIXED: Advanced logic for branching nodes with maximum spacing
                    if (totalSiblings > 1) {
                        // For even number of siblings: left, right, left, right...
                        // For odd number: left, right, center, left, right...
                        if (totalSiblings === 2) {
                            // Two siblings: first on left, second on right
                            isLeftSide = siblingIndex === 0;
                        } else if (totalSiblings === 3) {
                            // Three siblings: left, center, right
                            if (siblingIndex === 0) isLeftSide = true;
                            else if (siblingIndex === 1) {
                                // Center sibling: use position-based logic
                                isLeftSide = d.x < width / 2;
                            } else isLeftSide = false;
                        } else {
                            // More than 3 siblings: alternate sides
                            isLeftSide = siblingIndex % 2 === 0;
                        }
                    } else {
                        // Single child: use position-based logic
                        isLeftSide = d.x < width / 2;
                    }
                } else {
                    // Root or nodes without siblings: use position-based logic
                    isLeftSide = d.x < width / 2;
                }
                
                // FIXED: Advanced depth-based positioning to prevent overlaps
                if (d.depth > 1) {
                    // For deeper levels, alternate sides based on depth to create visual hierarchy
                    isLeftSide = (d.depth % 2 === 0) ? !isLeftSide : isLeftSide;
                }
                
                if (isLeftSide) {
                    xOffset = -xOffset;
                }
                
                // FIXED: Maximum depth offset for better separation
                const depthOffset = d.depth * 5.0; // Much larger depth offset
                yOffset += depthOffset;
                
                // FIXED: Maximum sibling offset to prevent overlaps
                if (d.parent && d.parent.children) {
                    const siblingIndex = d.parent.children.indexOf(d);
                    const totalSiblings = d.parent.children.length;
                    if (totalSiblings > 1) {
                        const siblingOffset = (siblingIndex - (totalSiblings - 1) / 2) * 6.0; // Much larger sibling offset
                        yOffset += siblingOffset;
                    }
                }
                
                // FIXED: Maximum text type offset to prevent overlap between operation and metrics
                if (textType === 'metrics') {
                    yOffset += 6.0; // Much larger offset for metrics
                } else if (textType === 'indicators') {
                    yOffset += 8.0; // Much larger offset for indicators
                }
                
                // FIXED: Enhanced position-based offset to prevent overlaps
                const positionOffset = (d.x % 200) * 0.2; // Larger offset based on x position
                yOffset += positionOffset;
                
                // FIXED: Add unique identifier offset to prevent overlaps
                const nodeId = d.data.operation ? d.data.operation.length : 0;
                const idOffset = (nodeId % 50) * 0.3; // Offset based on operation name length
                yOffset += idOffset;
                
                return {
                    x: xOffset,
                    y: yOffset,
                    anchor: isLeftSide ? "end" : "start"
                };
            }

            // Add connecting lines from nodes to operation labels
            node.append("line")
                .attr("class", "text-connector")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", d => calculateTextPosition(d, 'operation').x)
                .attr("y2", d => calculateTextPosition(d, 'operation').y * 12) // Convert em to px
                .style("stroke", "#374151")
                .style("stroke-width", "2px")
                .style("stroke-dasharray", "2,2")
                .style("opacity", "0.8")
                .style("z-index", "10")
                .style("pointer-events", "none");

            // Add labels for the nodes with improved spacing and collision avoidance
            node.append("text")
                .attr("class", "operation-label")
                .attr("dy", d => calculateTextPosition(d, 'operation').y + "em")
                .attr("x", d => calculateTextPosition(d, 'operation').x)
                .style("text-anchor", d => calculateTextPosition(d, 'operation').anchor)
                .text(d => {
                    // FIXED: More aggressive truncation to prevent overlap
                    const operation = d.data.operation;
                    return operation.length > 15 ? operation.substring(0, 13) + "..." : operation;
                })
                .style("font-size", "12px")
                .style("font-weight", "600")
                .style("fill", "#1f2937")
                .style("text-shadow", "0 2px 4px rgba(255,255,255,0.9)")
                .style("letter-spacing", "0.2px")
                .style("dominant-baseline", "middle")
                .style("z-index", "20")
                .style("pointer-events", "none");

            // Add enhanced metrics text with better spacing - ALWAYS SHOW METRICS
            node.append("text")
                .attr("class", "metrics")
                .attr("dy", d => calculateTextPosition(d, 'metrics').y + "em")
                .attr("x", d => calculateTextPosition(d, 'metrics').x)
                .style("text-anchor", d => calculateTextPosition(d, 'metrics').anchor)
                .text(d => {
                    let metrics = [];
                    // Always show cost if available (for all database engines)
                    if (d.data.cost !== undefined && d.data.cost !== null) {
                        metrics.push(`C:${d.data.cost.toFixed(1)}`);
                    }
                    // Always show rows if available (for all database engines)
                    if (d.data.rows !== undefined && d.data.rows !== null) {
                        metrics.push(`R:${d.data.rows.toLocaleString()}`);
                    }
                    // Always show time if available (for all database engines)
                    if (d.data.time !== undefined && d.data.time !== null && d.data.time > 0) {
                        metrics.push(`T:${d.data.time.toFixed(1)}ms`);
                    }
                    // Show buffers if available (for all database engines)
                    if (d.data.buffers && d.data.buffers.shared_read > 0) {
                        metrics.push(`IO:${d.data.buffers.shared_read}`);
                    }
                    // Show bytes if available (Oracle specific)
                    if (d.data.bytes !== undefined && d.data.bytes !== null && d.data.bytes > 0) {
                        metrics.push(`B:${d.data.bytes.toLocaleString()}`);
                    }
                    // If no metrics available, show a placeholder
                    if (metrics.length === 0) {
                        metrics.push("No metrics");
                    }
                    
                    const metricsText = metrics.join(" | ");
                    // FIXED: More aggressive truncation to prevent overlap
                    return metricsText.length > 25 ? metricsText.substring(0, 22) + "..." : metricsText;
                })
                .style("font-size", "10px")
                .style("fill", "#6b7280")
                .style("font-weight", "500")
                .style("text-shadow", "0 2px 4px rgba(255,255,255,0.9)")
                .style("dominant-baseline", "middle")
                .style("overflow", "visible")
                .style("white-space", "normal")
                .style("z-index", "15")
                .style("pointer-events", "none");

            // Add performance indicators with improved spacing and positioning
            node.append("text")
                .attr("class", "performance-indicators")
                .attr("dy", d => calculateTextPosition(d, 'indicators').y + "em")
                .attr("x", d => calculateTextPosition(d, 'indicators').x)
                .style("text-anchor", d => calculateTextPosition(d, 'indicators').anchor)
                .text(d => {
                    let indicators = [];
                    if (performanceHotspots.includes(d.data.cost)) {
                        indicators.push("🔥");
                    }
                    if (d.data.buffers && d.data.buffers.shared_read > maxBufferReads * 0.5) {
                        indicators.push("💾");
                    }
                    if (d.data.time > maxTime * 0.5) {
                        indicators.push("⏱️");
                    }
                    // FIX: Add scan operation indicators
                    if (isFullTableScan(d.data.operation)) {
                        indicators.push("📋"); // Full table scan indicator
                    } else if (isScanOperation(d.data.operation)) {
                        indicators.push("🔍"); // General scan indicator
                    }
                    const indicatorText = indicators.join("  "); // Double space between indicators
                    // Only show indicators if there are any to reduce clutter
                    return indicatorText;
                })
                .style("font-size", "11px") // Slightly larger for better visibility
                .style("fill", "#dc2626")
                .style("font-weight", "bold")
                .style("text-shadow", "0 2px 4px rgba(255,255,255,0.9)")
                .style("dominant-baseline", "middle")
                .style("z-index", "16") // Higher z-index to ensure visibility
                .style("pointer-events", "none");

            // Add tooltips with detailed information
            node.append("title")
                .text(d => {
                    let tooltip = `Operation: ${d.data.operation}\n`;
                    tooltip += `Cost: ${d.data.cost.toFixed(2)}\n`;
                    tooltip += `Rows: ${d.data.rows.toLocaleString()}\n`;
                    if (d.data.time > 0) tooltip += `Time: ${d.data.time.toFixed(2)}ms\n`;
                    if (d.data.buffers) {
                        if (d.data.buffers.shared_hit) tooltip += `Buffer Hits: ${d.data.buffers.shared_hit}\n`;
                        if (d.data.buffers.shared_read) tooltip += `Buffer Reads: ${d.data.buffers.shared_read}\n`;
                        if (d.data.buffers.shared_written) tooltip += `Buffer Writes: ${d.data.buffers.shared_written}\n`;
                    }
                    if (d.data.filter) tooltip += `Filter: ${d.data.filter}\n`;
                    if (d.data.join_condition) tooltip += `Join: ${d.data.join_condition}\n`;
                    if (performanceHotspots.includes(d.data.cost)) tooltip += `\n🔥 Performance Hotspot`;
                    // FIX: Add scan operation warnings
                    if (isFullTableScan(d.data.operation)) {
                        tooltip += `\n📋 Full Table Scan - Consider adding indexes for better performance`;
                    } else if (isScanOperation(d.data.operation)) {
                        tooltip += `\n🔍 Scan Operation - Review index usage`;
                    }
                    return tooltip;
                });

            // REMOVED: Legend creation code - now handled in HTML template

            // FIXED: Set initial zoom/pan to center the visualization properly
            setTimeout(() => {
                // FIXED: Better initial positioning to center the visualization properly
                const renderedBounds = contentGroup.node().getBBox();
                const containerRect = container.getBoundingClientRect();
                
                // Calculate the scale to fit the tree in the container
                const scaleX = (containerRect.width * 0.85) / Math.max(renderedBounds.width, 1);
                const scaleY = (containerRect.height * 0.85) / Math.max(renderedBounds.height, 1);
                const initialScale = Math.min(scaleX, scaleY, 1);
                
                // FIXED: Better centering calculation to prevent right-side drift
                const centerX = (containerRect.width - renderedBounds.width * initialScale) / 2 - renderedBounds.x * initialScale;
                const centerY = (containerRect.height - renderedBounds.height * initialScale) / 2 - renderedBounds.y * initialScale;
                
                // Apply the initial transform with proper centering
                const initialTransform = d3.zoomIdentity
                    .translate(centerX, centerY)
                    .scale(initialScale);
                
                svg.call(zoom.transform, initialTransform);
            }, 150); // Increased delay to ensure rendering is complete
            
            // Add visualization controls
            addVisualizationControls(vizContainer, container);
            
            // Details panel for node info (detailed mode)
            const detailsPanel = d3.select(container).append("div")
                .attr("class", "plan-details-panel")
                .style("position", "absolute")
                .style("top", "10px")
                .style("right", "10px")
                .style("max-width", "320px")
                .style("background", "rgba(255,255,255,0.95)")
                .style("border", "1px solid rgba(0,0,0,0.1)")
                .style("border-radius", "6px")
                .style("padding", "8px 10px")
                .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)")
                .html("<div style='font-weight:600;margin-bottom:4px;'>Node Details</div><div class='small text-muted'>Click a node to see details</div>");

            node.on("click", (event, d) => {
                event.stopPropagation();
                const data = d.data || {};
                const safe = (v) => (v === undefined || v === null ? "—" : v);
                detailsPanel.html(`
                    <div style="font-weight:600;margin-bottom:6px;">${safe(data.operation)}</div>
                    <div class="small">
                        <div><strong>Cost:</strong> ${safe(Number(data.cost)?.toFixed?.(2) ?? data.cost)}</div>
                        <div><strong>Rows:</strong> ${safe(data.rows)}</div>
                        ${data.time ? `<div><strong>Time:</strong> ${Number(data.time).toFixed(2)} ms</div>` : ''}
                        ${data.table_name ? `<div><strong>Table:</strong> ${data.table_name}</div>` : ''}
                        ${data.filter ? `<div><strong>Filter:</strong> <code>${data.filter}</code></div>` : ''}
                        ${data.join_condition ? `<div><strong>Join:</strong> <code>${data.join_condition}</code></div>` : ''}
                    </div>
                `);
            });

            d3.select(container).on("click", () => {
                detailsPanel.html("<div style='font-weight:600;margin-bottom:4px;'>Node Details</div><div class='small text-muted'>Click a node to see details</div>");
            });
            
            // IMPROVED: Add interaction hint with better positioning
            const interactionHint = d3.select(container).append("div")
                .style("position", "absolute")
                .style("top", "10px")
                .style("left", "10px")
                .style("background", "rgba(59, 130, 246, 0.9)")
                .style("color", "white")
                .style("padding", "8px 12px")
                .style("border-radius", "6px")
                .style("font-size", "12px")
                .style("font-weight", "500")
                .style("z-index", "1000")
                .style("box-shadow", "0 2px 8px rgba(0,0,0,0.2)")
                .style("pointer-events", "none")
                .style("opacity", "0.9")
                .text("🖱️ Drag to pan • Scroll to zoom • Click buttons for controls");
            
            // Auto-hide interaction hint after 5 seconds
            setTimeout(() => {
                interactionHint.style("opacity", "0").transition().duration(500).remove();
            }, 5000);
            
            console.log("renderDetailedTree completed successfully");
        }

        // Compact visualization for complex plans (≥16 nodes)
        function renderCompactTree(treeData, container) {
            console.log("renderCompactTree called with:", {treeData, container});
            
            // Calculate plan complexity
            const planComplexity = calculatePlanComplexity(treeData);
            console.log("Compact tree plan complexity:", planComplexity);
            
            // Set dimensions optimized for complex plans
            const baseMargin = {top: 60, right: 300, bottom: 80, left: 300};
            const complexityMultiplier = Math.max(1, planComplexity / 25); // Less aggressive scaling
            
            const margin = {
                top: baseMargin.top * complexityMultiplier,
                right: baseMargin.right * complexityMultiplier,
                bottom: baseMargin.bottom * complexityMultiplier,
                left: baseMargin.left * complexityMultiplier
            };
    
            const width = Math.max(container.clientWidth - margin.right - margin.left, 1600);
            const height = Math.max(1400 - margin.top - margin.bottom, 1000);
            
            console.log("Compact tree dimensions:", {width, height, margin});
            console.log("Container dimensions:", {clientWidth: container.clientWidth, clientHeight: container.clientHeight});

            // Clear container
            container.innerHTML = '';
            console.log("Compact tree container cleared");

            // Create main visualization container with proper containment
            const vizContainer = d3.select(container).append("div")
                .style("position", "relative")
                .style("width", "100%")
                .style("height", "100%")
                .style("border-radius", "8px")
                .style("background", "#f0f8ff") // Light blue background to make it visible
                .style("border", "2px solid #e5e7eb")
                .style("overflow", "hidden"); // FIX: Add overflow hidden to prevent dragging outside
            
            console.log("Compact tree viz container created");

            // Create SVG with larger dimensions for complex plans
            const svg = vizContainer.append("svg")
                .attr("width", width + margin.right + margin.left)
                .attr("height", height + margin.top + margin.bottom)
                .style("overflow", "visible");
            
            // Create the main content group that will be transformed by zoom
            const contentGroup = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);
            
            console.log("Compact tree SVG created with dimensions:", {
                width: width + margin.right + margin.left,
                height: height + margin.top + margin.bottom,
                margin: margin
            });

            // FIXED: Improved zoom behavior with better centering and drag constraints
            const zoom = d3.zoom()
                .scaleExtent([0.2, 4]) // Increased max zoom for better visibility
                .translateExtent([[-width * 3, -height * 3], [width * 4, height * 4]]) // Much larger drag area
                .on("zoom", (event) => {
                    // Apply transform with proper margins and better centering
                    const transform = event.transform;
                    contentGroup.attr("transform", `translate(${margin.left},${margin.top}) scale(${transform.k}) translate(${transform.x},${transform.y})`);
                });

            vizContainer.select("svg").call(zoom);
            
            // Set initial cursor for better UX
            vizContainer.style("cursor", "grab");
            
            console.log("Compact tree zoom behavior added");

            // Use the tree data directly from backend
            const root = d3.hierarchy(treeData, d => d.children);
            console.log("Compact tree hierarchy created:", root);
            
            // Calculate performance metrics for color coding
            let maxCost = 0;
            let maxTime = 0;
            let maxBufferReads = 0;
            let performanceHotspots = [];
            
            root.each(d => {
                if (d.data.cost > maxCost) maxCost = d.data.cost;
                if (d.data.time > maxTime) maxTime = d.data.time;
                if (d.data.buffers && d.data.buffers.shared_read > maxBufferReads) {
                    maxBufferReads = d.data.buffers.shared_read;
                }
            });
            
            console.log("Compact tree performance metrics:", {maxCost, maxTime, maxBufferReads});
            
            // Ensure we have minimum values for color scale calculation
            if (maxCost === 0) maxCost = 1;
            if (maxTime === 0) maxTime = 1;
            if (maxBufferReads === 0) maxBufferReads = 1;
            
            // Identify performance hotspots (top 15% by cost for complex plans)
            const allNodes = root.descendants().filter(d => d.data.cost > 0);
            allNodes.sort((a, b) => b.data.cost - a.data.cost);
            const hotspotCount = Math.max(1, Math.floor(allNodes.length * 0.15));
            performanceHotspots = allNodes.slice(0, hotspotCount).map(d => d.data.cost);
            
            // FIX: Add function to detect scan operations that might need indexes
            function isScanOperation(operation) {
                const scanKeywords = [
                    'TABLE ACCESS FULL', 'SEQUENTIAL SCAN', 'TABLE SCAN', 
                    'INDEX SCAN', 'BITMAP INDEX SCAN', 'INDEX FAST FULL SCAN',
                    'CLUSTERED INDEX SCAN', 'NONCLUSTERED INDEX SCAN',
                    'TABLE ACCESS BY INDEX ROWID', 'INDEX RANGE SCAN'
                ];
                return scanKeywords.some(keyword => 
                    operation.toUpperCase().includes(keyword.toUpperCase())
                );
            }

            // FIX: Add function to detect full table scans specifically
            function isFullTableScan(operation) {
                const fullScanKeywords = [
                    'TABLE ACCESS FULL', 'SEQUENTIAL SCAN', 'TABLE SCAN'
                ];
                return fullScanKeywords.some(keyword => 
                    operation.toUpperCase().includes(keyword.toUpperCase())
                );
            }
            
            // Enhanced color scale
            const colorDomain = Math.max(maxCost, maxTime * 100, maxBufferReads * 10);

            const colorScale = d3.scaleLinear()
                .domain([0, colorDomain])
                .range(["#10b981", "#f59e0b", "#ef4444"]);

            // Compact separation for complex plans
            const baseSeparation = 2.0;
            const separationMultiplier = Math.max(1, planComplexity / 20);
            
            // FIXED: Center the tree layout by default by adjusting the tree size and positioning
            const tree = d3.tree().size([width, height]).separation((a, b) => {
                const separation = baseSeparation * separationMultiplier;
                return (a.parent === b.parent ? separation : separation * 1.1);
            });

            // Assigns the data to a hierarchy using parent-child relationships
            const treeData2 = tree(root);

            // FIXED: Improved centering calculation to ensure topmost element is centered
            const treeBounds = treeData2.descendants().reduce((bounds, d) => {
                bounds.x0 = Math.min(bounds.x0, d.x);
                bounds.x1 = Math.max(bounds.x1, d.x);
                bounds.y0 = Math.min(bounds.y0, d.y);
                bounds.y1 = Math.max(bounds.y1, d.y);
                return bounds;
            }, {x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity});

            // FIXED: Better centering calculation for compact tree to prevent right-side orientation
            const treeWidth = treeBounds.x1 - treeBounds.x0;
            const treeHeight = treeBounds.y1 - treeBounds.y0;
            
            // Calculate scale to fit the tree in the container with margins
            const availableWidth = width - margin.left - margin.right;
            const availableHeight = height - margin.top - margin.bottom;
            const scaleX = availableWidth / Math.max(treeWidth, 1);
            const scaleY = availableHeight / Math.max(treeHeight, 1);
            const scale = Math.min(scaleX, scaleY, 0.9); // Increased scale for better visibility
            
            // FIXED: Better centering calculation to prevent right-side drift
            const centerX = (width - treeWidth * scale) / 2;
            const centerY = (height - treeHeight * scale) / 2;

            // Apply scaling and centering transform to all nodes
            treeData2.descendants().forEach(d => {
                d.x = (d.x - treeBounds.x0) * scale + centerX;
                d.y = (d.y - treeBounds.y0) * scale + centerY;
            });
            
            console.log("Compact tree bounds:", treeBounds);
            console.log("Compact tree positioning:", {treeWidth, treeHeight, centerX, centerY});

            // Apply centering transform to all nodes
            treeData2.descendants().forEach(d => {
                d.x += centerX;
                d.y += centerY;
            });

            // Compute the new tree layout
            const nodes = treeData2.descendants();
            const links = treeData2.links();

            // Declare the links with enhanced styling
            const link = contentGroup.selectAll(".link")
                .data(links)
                .enter().append("path")
                .attr("class", "link")
                .attr("d", d3.linkVertical()
                    .x(d => d.x)
                    .y(d => d.y))
                .style("fill", "none")
                .style("stroke", "#3b82f6")
                .style("stroke-width", 2)
                .style("stroke-opacity", 0.7)
                .style("z-index", "1");

            // Declare the nodes
            const node = contentGroup.selectAll(".node")
                .data(nodes)
                .enter().append("g")
                .attr("class", "node")
                .attr("transform", d => `translate(${d.x},${d.y})`)
                .style("z-index", "10");
            
            console.log("Compact tree nodes created, count:", nodes.length);
            
            // Debug: Show first few node positions
            console.log("First 5 node positions:", nodes.slice(0, 5).map(d => ({x: d.x, y: d.y, operation: d.data.operation})));

            // Add the circles for the nodes with compact sizing
            node.append("circle")
                .attr("r", d => {
                    // Smaller circles for compact mode
                    const baseRadius = 18;
                    if (performanceHotspots.includes(d.data.cost)) {
                        return baseRadius + 8;
                    }
                    if (d.data.cost > maxCost * 0.5) {
                        return baseRadius + 4;
                    }
                    return baseRadius;
                })
                .style("fill", d => {
                    // Enhanced multi-factor color coding
                    const costFactor = d.data.cost / maxCost;
                    const timeFactor = d.data.time / maxTime;
                    const bufferFactor = d.data.buffers && d.data.buffers.shared_read ? d.data.buffers.shared_read / maxBufferReads : 0;
                    
                    // Ensure we have valid factors
                    const validCostFactor = isNaN(costFactor) ? 0 : costFactor;
                    const validTimeFactor = isNaN(timeFactor) ? 0 : timeFactor;
                    const validBufferFactor = isNaN(bufferFactor) ? 0 : bufferFactor;
                    
                    const totalFactor = Math.max(validCostFactor, validTimeFactor, validBufferFactor);
                    const colorValue = colorScale(totalFactor * colorDomain);
                    
                    return colorValue;
                })
                .style("stroke", d => {
                    // FIX: Add special highlighting for scan operations
                    if (isFullTableScan(d.data.operation)) {
                        return "#dc2626"; // Red border for full table scans
                    }
                    if (isScanOperation(d.data.operation)) {
                        return "#f59e0b"; // Orange border for other scans
                    }
                    if (performanceHotspots.includes(d.data.cost)) {
                        return "#1f2937";
                    }
                    return d.data.cost === maxCost ? "#1f2937" : "#ffffff";
                })
                .style("stroke-width", d => {
                    // FIX: Thicker border for scan operations
                    if (isScanOperation(d.data.operation)) {
                        return 3;
                    }
                    if (performanceHotspots.includes(d.data.cost)) {
                        return 3;
                    }
                    return d.data.cost === maxCost ? 2.5 : 2;
                })
                .style("stroke-dasharray", d => {
                    // FIX: Special pattern for full table scans
                    if (isFullTableScan(d.data.operation)) {
                        return "6,3"; // Dashed pattern for full scans
                    }
                    if (d.data.buffers && d.data.buffers.shared_read > 0) {
                        return "4,4";
                    }
                    return "none";
                })
                .style("filter", d => {
                    // FIX: Add glow effect for scan operations
                    if (isFullTableScan(d.data.operation)) {
                        return "drop-shadow(0 0 6px rgba(220, 38, 38, 0.5))"; // Red glow for full scans
                    }
                    if (isScanOperation(d.data.operation)) {
                        return "drop-shadow(0 0 4px rgba(245, 158, 11, 0.4))"; // Orange glow for scans
                    }
                    if (performanceHotspots.includes(d.data.cost)) {
                        return "drop-shadow(0 3px 6px rgba(0,0,0,0.2))";
                    }
                    return "drop-shadow(0 1px 3px rgba(0,0,0,0.1))";
                })
                .style("z-index", "5");
            
            console.log("Compact tree circles added");

                    // FIX: IMPROVED compact text positioning function with better branch handling
        function calculateCompactTextPosition(d, textType) {
            const baseOffset = 40 * complexityMultiplier; // Much larger base offset
            const verticalSpacing = {
                'operation': 0,
                'metrics': 2.5 * complexityMultiplier, // Much larger spacing
                'indicators': 4.0 * complexityMultiplier // Much larger spacing
            };
            
            let xOffset = baseOffset;
            let yOffset = verticalSpacing[textType] || 0;
            
            // FIXED: Advanced side determination for better branch clarity
            let isLeftSide = false;
            
            // For nodes with siblings, place text on opposite sides
            if (d.parent && d.parent.children) {
                const siblings = d.parent.children;
                const siblingIndex = siblings.indexOf(d);
                const totalSiblings = siblings.length;
                
                // FIXED: Advanced logic for branching nodes - use opposite sides consistently
                if (totalSiblings > 1) {
                    // For even number of siblings: left, right, left, right...
                    // For odd number: left, right, center, left, right...
                    if (totalSiblings === 2) {
                        // Two siblings: first on left, second on right
                        isLeftSide = siblingIndex === 0;
                    } else if (totalSiblings === 3) {
                        // Three siblings: left, center, right
                        if (siblingIndex === 0) isLeftSide = true;
                        else if (siblingIndex === 1) {
                            // Center sibling: use position-based logic
                            isLeftSide = d.x < width / 2;
                        } else isLeftSide = false;
                    } else {
                        // More than 3 siblings: alternate sides
                        isLeftSide = siblingIndex % 2 === 0;
                    }
                } else {
                    // Single child: use position-based logic
                    isLeftSide = d.x < width / 2;
                }
            } else {
                // Root or nodes without siblings: use position-based logic
                isLeftSide = d.x < width / 2;
            }
            
            // Adjust for depth to create better visual hierarchy
            if (d.depth > 1) {
                isLeftSide = !isLeftSide; // Invert for deeper levels
            }
            
            if (isLeftSide) {
                xOffset = -xOffset;
            }
            
            // FIXED: Maximum depth offset for better separation
            const depthOffset = d.depth * 2.0; // Much larger depth offset
            yOffset += depthOffset;
            
            // FIXED: Maximum sibling offset to prevent overlaps
            if (d.parent && d.parent.children) {
                const siblingIndex = d.parent.children.indexOf(d);
                const totalSiblings = d.parent.children.length;
                if (totalSiblings > 1) {
                    const siblingOffset = (siblingIndex - (totalSiblings - 1) / 2) * 3.0; // Much larger sibling offset
                    yOffset += siblingOffset;
                }
            }
            
            // FIXED: Maximum text type offset to prevent overlap between operation and metrics
            if (textType === 'metrics') {
                yOffset += 2.5; // Much larger offset for metrics
            } else if (textType === 'indicators') {
                yOffset += 3.5; // Much larger offset for indicators
            }
            
            // FIXED: Enhanced position-based offset to prevent overlaps
            const positionOffset = (d.x % 100) * 0.2; // Larger offset based on x position
            yOffset += positionOffset;
            
            // FIXED: Add unique identifier offset to prevent overlaps
            const nodeId = d.data.operation ? d.data.operation.length : 0;
            const idOffset = (nodeId % 30) * 0.4; // Offset based on operation name length
            yOffset += idOffset;
            
            return {
                x: xOffset,
                y: yOffset,
                anchor: isLeftSide ? "end" : "start",
                isLeftSide: isLeftSide
            };
        }

            // Remove long connector lines in compact mode to reduce clutter
            // Labels will be placed closer to nodes
            // node.append("line")
            //     .attr("class", "text-connector")
            //     .attr("x1", 0)
            //     .attr("y1", 0)
            //     .attr("x2", d => calculateCompactTextPosition(d, 'operation').x)
            //     .attr("y2", d => calculateCompactTextPosition(d, 'operation').y * 12)
            //     .style("stroke", "#374151")
            //     .style("stroke-width", "2px")
            //     .style("stroke-dasharray", "2,2")
            //     .style("opacity", "0.8")
            //     .style("z-index", "10")
            //     .style("pointer-events", "none");

            // Simplified operation labels with cleaner styling
            node.append("text")
                .attr("class", "operation-label-compact")
                .attr("dy", d => 0)
                .attr("x", d => (d.parent ? (d.parent.children && d.parent.children.length > 1 ? (d.parent.children.indexOf(d) % 2 === 0 ? -24 : 24) : 24) : 24))
                .style("text-anchor", d => (d.parent && d.parent.children && d.parent.children.length > 1 ? (d.parent.children.indexOf(d) % 2 === 0 ? "end" : "start") : "start"))
                .text(d => {
                    const operation = d.data.operation;
                    return operation.length > 18 ? operation.substring(0, 16) + "..." : operation;
                })
                .style("font-size", "10px") // Smaller font
                .style("font-weight", "600")
                .style("fill", "#1f2937")
                .style("dominant-baseline", "middle")
                .style("z-index", "20")
                .style("pointer-events", "none")
                .style("background", "rgba(255,255,255,0.9)") // Lighter background
                .style("padding", "2px 4px") // Smaller padding
                .style("border-radius", "3px")
                .style("border", "1px solid rgba(107, 114, 128, 0.15)");

            // Metrics text without indicators (separated for better clarity)
            node.append("text")
                .attr("class", "metrics-compact")
                .attr("dy", d => 1.6 + "em")
                .attr("x", d => (d.parent ? (d.parent.children && d.parent.children.length > 1 ? (d.parent.children.indexOf(d) % 2 === 0 ? -24 : 24) : 24) : 24))
                .style("text-anchor", d => (d.parent && d.parent.children && d.parent.children.length > 1 ? (d.parent.children.indexOf(d) % 2 === 0 ? "end" : "start") : "start"))
                .style("display", "none")
                .text(d => {
                    let metrics = [];
                    
                    // Build metrics string (for all database engines)
                    if (d.data.cost !== undefined && d.data.cost !== null) {
                        metrics.push(`C:${d.data.cost.toFixed(1)}`);
                    }
                    if (d.data.rows !== undefined && d.data.rows !== null) {
                        metrics.push(`R:${d.data.rows.toLocaleString()}`);
                    }
                    if (d.data.time !== undefined && d.data.time !== null && d.data.time > 0) {
                        metrics.push(`T:${d.data.time.toFixed(1)}`);
                    }
                    if (d.data.buffers && d.data.buffers.shared_read > 0) {
                        metrics.push(`IO:${d.data.buffers.shared_read}`);
                    }
                    // Show bytes if available (Oracle specific)
                    if (d.data.bytes !== undefined && d.data.bytes !== null && d.data.bytes > 0) {
                        metrics.push(`B:${d.data.bytes.toLocaleString()}`);
                    }
                    
                    return metrics.join(" | ");
                })
                .style("font-size", "8px") // Smaller font
                .style("fill", "#6b7280")
                .style("font-weight", "500")
                .style("dominant-baseline", "middle")
                .style("z-index", "15")
                .style("pointer-events", "none")
                .style("background", "rgba(255,255,255,0.85)")
                .style("padding", "1px 3px")
                .style("border-radius", "2px")
                .style("border", "1px solid rgba(107, 114, 128, 0.1)");

            // Separate performance indicators with proper spacing
            node.append("text")
                .attr("class", "performance-indicators-compact")
                .attr("dy", d => -1.4 + "em")
                .attr("x", d => (d.parent ? (d.parent.children && d.parent.children.length > 1 ? (d.parent.children.indexOf(d) % 2 === 0 ? -24 : 24) : 24) : 24))
                .style("text-anchor", d => (d.parent && d.parent.children && d.parent.children.length > 1 ? (d.parent.children.indexOf(d) % 2 === 0 ? "end" : "start") : "start"))
                .style("display", "none")
                .text(d => {
                    let indicators = [];
                    
                    // Collect indicators with proper spacing
                    if (performanceHotspots.includes(d.data.cost)) {
                        indicators.push("🔥");
                    }
                    if (d.data.buffers && d.data.buffers.shared_read > maxBufferReads * 0.5) {
                        indicators.push("💾");
                    }
                    if (d.data.time > maxTime * 0.5) {
                        indicators.push("⏱️");
                    }
                    // FIX: Add scan operation indicators
                    if (isFullTableScan(d.data.operation)) {
                        indicators.push("📋"); // Full table scan indicator
                    } else if (isScanOperation(d.data.operation)) {
                        indicators.push("🔍"); // General scan indicator
                    }
                    
                    return indicators.join("  "); // Double space between indicators
                })
                .style("font-size", "10px") // Slightly larger for better visibility
                .style("fill", "#dc2626")
                .style("font-weight", "bold")
                .style("dominant-baseline", "middle")
                .style("z-index", "16") // Higher z-index to ensure visibility
                .style("pointer-events", "none")
                .style("text-shadow", "0 1px 2px rgba(255,255,255,0.9)");

            // Simplified hotspot indicator - only for the most critical nodes
            node.filter(d => {
                return performanceHotspots.includes(d.data.cost) && d.data.cost > maxCost * 0.8; // Only top 20% of hotspots
            })
            .append("circle")
                .attr("r", d => 22 + (d.data.cost / maxCost) * 3) // Smaller glow
                .style("fill", "none")
                .style("stroke", "#dc2626")
                .style("stroke-width", "1.5px") // Thinner stroke
                .style("stroke-dasharray", "4,4") // Smaller dash pattern
                .style("opacity", "0.4") // Lower opacity
                .style("z-index", "1")
                .style("pointer-events", "none");



            // Add comprehensive tooltips with all metrics for compact mode
            node.append("title")
                .text(d => {
                    let tooltip = `Operation: ${d.data.operation}\n`;
                    tooltip += `Cost: ${d.data.cost.toFixed(2)}\n`;
                    tooltip += `Rows: ${d.data.rows.toLocaleString()}\n`;
                    if (d.data.time > 0) tooltip += `Time: ${d.data.time.toFixed(2)}ms\n`;
                    if (d.data.buffers) {
                        if (d.data.buffers.shared_hit) tooltip += `Buffer Hits: ${d.data.buffers.shared_hit}\n`;
                        if (d.data.buffers.shared_read) tooltip += `Buffer Reads: ${d.data.buffers.shared_read}\n`;
                        if (d.data.buffers.shared_written) tooltip += `Buffer Writes: ${d.data.buffers.shared_written}\n`;
                    }
                    if (d.data.filter) tooltip += `Filter: ${d.data.filter}\n`;
                    if (d.data.join_condition) tooltip += `Join: ${d.data.join_condition}\n`;
                    if (performanceHotspots.includes(d.data.cost)) tooltip += `\n🔥 Performance Hotspot`;
                    if (d.data.buffers && d.data.buffers.shared_read > maxBufferReads * 0.5) tooltip += `\n💾 I/O Heavy`;
                    if (d.data.time > maxTime * 0.5) tooltip += `\n⏱️ Slow Operation`;
                    // FIX: Add scan operation warnings
                    if (isFullTableScan(d.data.operation)) {
                        tooltip += `\n📋 Full Table Scan - Consider adding indexes for better performance`;
                    } else if (isScanOperation(d.data.operation)) {
                        tooltip += `\n🔍 Scan Operation - Review index usage`;
                    }
                    return tooltip;
                });

            // REMOVED: Performance Legend - now available as static content on results page

            // FIXED: Set initial zoom/pan to center the visualization properly
            setTimeout(() => {
                // FIXED: Better initial positioning to center the visualization properly
                const renderedBounds = contentGroup.node().getBBox();
                const containerRect = container.getBoundingClientRect();
                
                // Calculate the scale to fit the tree in the container
                const scaleX = (containerRect.width * 0.85) / Math.max(renderedBounds.width, 1);
                const scaleY = (containerRect.height * 0.85) / Math.max(renderedBounds.height, 1);
                const initialScale = Math.min(scaleX, scaleY, 1);
                
                // FIXED: Better centering calculation to prevent right-side drift
                const centerX = (containerRect.width - renderedBounds.width * initialScale) / 2 - renderedBounds.x * initialScale;
                const centerY = (containerRect.height - renderedBounds.height * initialScale) / 2 - renderedBounds.y * initialScale;
                
                // Apply the initial transform with proper centering
                const initialTransform = d3.zoomIdentity
                    .translate(centerX, centerY)
                    .scale(initialScale);
                
                vizContainer.select("svg").call(zoom.transform, initialTransform);
            }, 150); // Increased delay to ensure rendering is complete
            
            // Add visualization controls
            addVisualizationControls(vizContainer, container);
            
            // Details panel for node info (compact mode)
            const detailsPanelCompact = d3.select(container).append("div")
                .attr("class", "plan-details-panel")
                .style("position", "absolute")
                .style("top", "10px")
                .style("right", "10px")
                .style("max-width", "320px")
                .style("background", "rgba(255,255,255,0.95)")
                .style("border", "1px solid rgba(0,0,0,0.1)")
                .style("border-radius", "6px")
                .style("padding", "8px 10px")
                .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)")
                .html("<div style='font-weight:600;margin-bottom:4px;'>Node Details</div><div class='small text-muted'>Click a node to see details</div>");

            node.on("click", (event, d) => {
                event.stopPropagation();
                const data = d.data || {};
                const safe = (v) => (v === undefined || v === null ? "—" : v);
                detailsPanelCompact.html(`
                    <div style="font-weight:600;margin-bottom:6px;">${safe(data.operation)}</div>
                    <div class="small">
                        <div><strong>Cost:</strong> ${safe(Number(data.cost)?.toFixed?.(2) ?? data.cost)}</div>
                        <div><strong>Rows:</strong> ${safe(data.rows)}</div>
                        ${data.time ? `<div><strong>Time:</strong> ${Number(data.time).toFixed(2)} ms</div>` : ''}
                        ${data.table_name ? `<div><strong>Table:</strong> ${data.table_name}</div>` : ''}
                        ${data.filter ? `<div><strong>Filter:</strong> <code>${data.filter}</code></div>` : ''}
                        ${data.join_condition ? `<div><strong>Join:</strong> <code>${data.join_condition}</code></div>` : ''}
                    </div>
                `);
            });

            d3.select(container).on("click", () => {
                detailsPanelCompact.html("<div style='font-weight:600;margin-bottom:4px;'>Node Details</div><div class='small text-muted'>Click a node to see details</div>");
            });

            // Add keyboard shortcut for reset view
            const handleKeyPress = (event) => {
                if (event.key === 'r' || event.key === 'R') {
                    event.preventDefault();
                    resetZoom();
                }
            };
            document.addEventListener('keydown', handleKeyPress);
            
            // Store the event listener for cleanup
            container._keyPressHandler = handleKeyPress;
            
            console.log("renderCompactTree completed successfully");
        }

        // Helper function to add visualization controls
        function addVisualizationControls(vizContainer, container) {
            // Create controls container
            const controlsContainer = d3.select(container).append("div")
                .style("position", "absolute")
                .style("bottom", "20px")
                .style("left", "20px")
                .style("z-index", "1000")
                .style("display", "flex")
                .style("gap", "8px")
                .style("flex-wrap", "wrap")
                .style("background", "rgba(255, 255, 255, 0.95)")
                .style("padding", "8px")
                .style("border-radius", "6px")
                .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)")
                .style("border", "1px solid rgba(0,0,0,0.1)");

            // Fit to Screen button
            controlsContainer.append("button")
                .attr("type", "button")
                .attr("class", "btn btn-outline-primary btn-sm")
                .style("font-size", "11px")
                .style("padding", "4px 8px")
                .style("border-radius", "6px")
                .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                .text("Fit to Screen")
                .on("click", function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    // FIXED: Proper fit to screen functionality
                    const svg = vizContainer.select("svg");
                    const contentGroup = svg.select("g");
                    const containerRect = container.getBoundingClientRect();
                    const renderedBounds = contentGroup.node().getBBox();
                    
                    // Calculate the scale to fit the tree in the container
                    const scaleX = (containerRect.width * 0.85) / Math.max(renderedBounds.width, 1);
                    const scaleY = (containerRect.height * 0.85) / Math.max(renderedBounds.height, 1);
                    const initialScale = Math.min(scaleX, scaleY, 1);
                    
                    // Calculate the translation to center the tree
                    const centerX = (containerRect.width - renderedBounds.width * initialScale) / 2 - renderedBounds.x * initialScale;
                    const centerY = (containerRect.height - renderedBounds.height * initialScale) / 2 - renderedBounds.y * initialScale;
                    
                    // Apply the initial transform
                    const initialTransform = d3.zoomIdentity
                        .translate(centerX, centerY)
                        .scale(initialScale);
                    
                    svg.call(svg.attr("data-zoom").transform, initialTransform);
                });

            // Zoom In button
            controlsContainer.append("button")
                .attr("type", "button")
                .attr("class", "btn btn-outline-primary btn-sm")
                .style("font-size", "11px")
                .style("padding", "4px 8px")
                .style("border-radius", "6px")
                .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                .text("Zoom In")
                .on("click", function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    const svg = vizContainer.select("svg");
                    const zoom = svg.attr("data-zoom");
                    if (zoom) {
                        svg.call(zoom.scaleBy, 1.5);
                    }
                });

            // Zoom Out button
            controlsContainer.append("button")
                .attr("type", "button")
                .attr("class", "btn btn-outline-primary btn-sm")
                .style("font-size", "11px")
                .style("padding", "4px 8px")
                .style("border-radius", "6px")
                .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                .text("Zoom Out")
                .on("click", function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    const svg = vizContainer.select("svg");
                    const zoom = svg.attr("data-zoom");
                    if (zoom) {
                        svg.call(zoom.scaleBy, 0.75);
                    }
                });

            // Reset View button
            controlsContainer.append("button")
                .attr("type", "button")
                .attr("class", "btn btn-outline-secondary btn-sm")
                .style("font-size", "11px")
                .style("padding", "4px 8px")
                .style("border-radius", "6px")
                .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                .text("Reset View")
                .on("click", function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    const svg = vizContainer.select("svg");
                    const zoom = svg.attr("data-zoom");
                    if (zoom) {
                        svg.call(zoom.transform, d3.zoomIdentity);
                    }
                });

            // Export PNG button
            controlsContainer.append("button")
                .attr("type", "button")
                .attr("class", "btn btn-outline-success btn-sm")
                .style("font-size", "11px")
                .style("padding", "4px 8px")
                .style("border-radius", "6px")
                .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                .text("Export PNG")
                .on("click", function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    exportToPNG(vizContainer);
                });

            // Export SVG button
            controlsContainer.append("button")
                .attr("type", "button")
                .attr("class", "btn btn-outline-success btn-sm")
                .style("font-size", "11px")
                .style("padding", "4px 8px")
                .style("border-radius", "6px")
                .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                .text("Export SVG")
                .on("click", function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    exportToSVG(vizContainer);
                });

            // Reset View button
            controlsContainer.append("button")
                .attr("type", "button")
                .attr("class", "btn btn-outline-secondary btn-sm")
                .style("font-size", "11px")
                .style("padding", "4px 8px")
                .style("border-radius", "6px")
                .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                .text("Reset View")
                .on("click", function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    const svg = vizContainer.select("svg");
                    const contentGroup = svg.select("g");
                    const margin = {left: 300, top: 60};
                    contentGroup.attr("transform", `translate(${margin.left},${margin.top})`);
                });
        }

// Export functions for visualization controls
function exportToPNG(vizContainer) {
    try {
        const svg = vizContainer.select("svg").node();
        if (!svg) {
            console.error('SVG element not found');
            return;
        }
        
        // Create a canvas to convert SVG to PNG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Get SVG dimensions
        const svgRect = svg.getBoundingClientRect();
        canvas.width = svgRect.width;
        canvas.height = svgRect.height;
        
        // Convert SVG to data URL
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        
        // Create image and draw to canvas
        const img = new Image();
        img.onload = function() {
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            
            // Convert canvas to blob and download
            canvas.toBlob(function(blob) {
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = 'execution_plan.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
            });
        };
        img.src = url;
    } catch (error) {
        console.error('Error exporting to PNG:', error);
        alert('Failed to export PNG. Please try again.');
    }
}

function exportToSVG(vizContainer) {
    try {
        const svg = vizContainer.select("svg").node();
        if (!svg) {
            console.error('SVG element not found');
            return;
        }
        
        // Serialize SVG to string
        const svgData = new XMLSerializer().serializeToString(svg);
        
        // Create blob and download
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'execution_plan.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting to SVG:', error);
        alert('Failed to export SVG. Please try again.');
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

// Sample data definitions for each database engine
const engineSamples = {
    postgresql: {
        sql: `WITH monthly_sales AS (
    SELECT 
        p.category_id,
        DATE_TRUNC('month', o.created_at) as sale_month,
        SUM(oi.quantity * oi.unit_price) as total_sales,
        COUNT(DISTINCT o.customer_id) as unique_customers
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    WHERE o.status = 'completed'
    AND o.created_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY p.category_id, DATE_TRUNC('month', o.created_at)
),
category_rankings AS (
    SELECT 
        c.category_name,
        ms.sale_month,
        ms.total_sales,
        ms.unique_customers,
        RANK() OVER (PARTITION BY ms.sale_month ORDER BY ms.total_sales DESC) as sales_rank,
        LAG(ms.total_sales) OVER (PARTITION BY c.category_id ORDER BY ms.sale_month) as prev_month_sales
    FROM monthly_sales ms
    JOIN categories c ON ms.category_id = c.category_id
)
SELECT 
    cr.category_name,
    cr.sale_month,
    cr.total_sales,
    cr.unique_customers,
    cr.sales_rank,
    ROUND((cr.total_sales - cr.prev_month_sales) / NULLIF(cr.prev_month_sales, 0) * 100, 2) as sales_growth_pct,
    EXISTS (
        SELECT 1 
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN categories c ON p.category_id = c.category_id
        WHERE c.category_name = cr.category_name
        AND i.stock_level < i.reorder_point
    ) as needs_restock
FROM category_rankings cr
WHERE cr.sales_rank <= 5
ORDER BY cr.sale_month DESC, cr.sales_rank;`,
        explain: `CTE Scan on category_rankings cr  (cost=25437.59..25439.11 rows=50 width=152)
  Output: cr.category_name, cr.sale_month, cr.total_sales, cr.unique_customers, cr.sales_rank, (round((((cr.total_sales - cr.prev_month_sales) / NULLIF(cr.prev_month_sales, 0.0)) * 100.0), 2)), (SubPlan 1)
  Filter: (cr.sales_rank <= 5)
  CTE monthly_sales
    ->  GroupAggregate  (cost=11754.98..12004.98 rows=1000 width=48)
          Output: p.category_id, date_trunc('month'::text, o.created_at), sum((oi.quantity * oi.unit_price)), count(DISTINCT o.customer_id)
          Group Key: p.category_id, date_trunc('month'::text, o.created_at)
          ->  Sort  (cost=11754.98..11817.48 rows=25000 width=36)
                Sort Key: p.category_id, date_trunc('month'::text, o.created_at)
                ->  Hash Join  (cost=2822.00..9879.75 rows=25000 width=36)
                      Hash Cond: (oi.product_id = p.product_id)
                      ->  Hash Join  (cost=1649.00..7331.75 rows=25000 width=32)
                            Hash Cond: (oi.order_id = o.order_id)
                            ->  Seq Scan on order_items oi  (cost=0.00..4457.00 rows=100000 width=20)
                            ->  Hash  (cost=1030.00..1030.00 rows=25000 width=20)
                                  ->  Seq Scan on orders o  (cost=0.00..1030.00 rows=25000 width=20)
                                        Filter: ((status = 'completed'::text) AND (created_at >= (CURRENT_DATE - '1 year'::interval)))
                      ->  Hash  (cost=952.00..952.00 rows=10000 width=8)
                            ->  Seq Scan on products p  (cost=0.00..952.00 rows=10000 width=8)
  CTE category_rankings
    ->  WindowAgg  (cost=13254.98..13429.98 rows=1000 width=56)
          Output: c.category_name, ms.sale_month, ms.total_sales, ms.unique_customers, (rank() OVER (?)), (lag(ms.total_sales) OVER (?))
          ->  Sort  (cost=13254.98..13257.48 rows=1000 width=48)
                Sort Key: ms.sale_month DESC
                ->  Hash Join  (cost=33.00..13179.98 rows=1000 width=48)
                      Hash Cond: (ms.category_id = c.category_id)
                      ->  CTE Scan on monthly_sales ms  (cost=0.00..20.00 rows=1000 width=32)
                      ->  Hash  (cost=20.50..20.50 rows=1000 width=20)
                            ->  Seq Scan on categories c  (cost=0.00..20.50 rows=1000 width=20)
  SubPlan 1
    ->  Nested Loop  (cost=8.45..1040.93 rows=1 width=1)
          ->  Hash Join  (cost=8.45..1027.45 rows=100 width=4)
                Hash Cond: (p.category_id = c_1.category_id)
                ->  Seq Scan on products p  (cost=0.00..952.00 rows=10000 width=8)
                ->  Hash  (cost=8.44..8.44 rows=1 width=4)
                      ->  Index Scan using categories_name_idx on categories c_1  (cost=0.28..8.44 rows=1 width=4)
                            Index Cond: ((category_name)::text = (cr.category_name)::text)
          ->  Index Scan using inventory_product_id_idx on inventory i  (cost=0.29..0.13 rows=1 width=1)
                Index Cond: (product_id = p.product_id)
                Filter: (stock_level < reorder_point)`,
        tables: [
            ['categories', 'CREATE TABLE categories (category_id INT PRIMARY KEY, category_name VARCHAR(100) NOT NULL, description TEXT, parent_category_id INT REFERENCES categories(category_id));', '1000', '500KB', true, 'category_id', false, '', ''],
            ['products', 'CREATE TABLE products (product_id INT PRIMARY KEY, category_id INT NOT NULL REFERENCES categories(category_id), product_name VARCHAR(200) NOT NULL, description TEXT, unit_price DECIMAL(10,2) NOT NULL, weight DECIMAL(8,2), dimensions VARCHAR(50));', '10000', '5MB', true, 'product_id', true, 'category_id', 'categories'],
            ['customers', 'CREATE TABLE customers (customer_id INT PRIMARY KEY, email VARCHAR(255) NOT NULL, first_name VARCHAR(50), last_name VARCHAR(50), address TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);', '50000', '10MB', true, 'customer_id', false, '', ''],
            ['orders', 'CREATE TABLE orders (order_id INT PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(customer_id), status VARCHAR(20) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, shipped_at TIMESTAMP, total_amount DECIMAL(12,2));', '100000', '20MB', true, 'order_id', true, 'customer_id', 'customers'],
            ['order_items', 'CREATE TABLE order_items (order_id INT REFERENCES orders(order_id), product_id INT REFERENCES products(product_id), quantity INT NOT NULL, unit_price DECIMAL(10,2) NOT NULL, PRIMARY KEY (order_id, product_id));', '250000', '40MB', true, 'order_id,product_id', true, 'product_id', 'products'],
            ['inventory', 'CREATE TABLE inventory (product_id INT PRIMARY KEY REFERENCES products(product_id), warehouse_id INT NOT NULL, stock_level INT NOT NULL, reorder_point INT NOT NULL, last_restock_date TIMESTAMP);', '10000', '2MB', true, 'product_id', false, '', '']
        ],
        indexes: [
            ['idx_category_name', 'categories', 'CREATE INDEX idx_category_name ON categories(category_name);', '100KB'],
            ['idx_product_category', 'products', 'CREATE INDEX idx_product_category ON products(category_id);', '1MB'],
            ['idx_customer_email', 'customers', 'CREATE UNIQUE INDEX idx_customer_email ON customers(email);', '2MB'],
            ['idx_order_customer', 'orders', 'CREATE INDEX idx_order_customer ON orders(customer_id);', '4MB'],
            ['idx_order_status_date', 'orders', 'CREATE INDEX idx_order_status_date ON orders(status, created_at);', '5MB'],
            ['idx_order_items_product', 'order_items', 'CREATE INDEX idx_order_items_product ON order_items(product_id);', '8MB'],
            ['idx_inventory_stock', 'inventory', 'CREATE INDEX idx_inventory_stock ON inventory(stock_level) WHERE stock_level < reorder_point;', '500KB']
        ]
    },
    mysql: {
        sql: `SELECT 
    p.product_name,
    c.category_name,
    COUNT(oi.order_id) as order_count,
    SUM(oi.quantity * oi.unit_price) as total_revenue,
    AVG(oi.unit_price) as avg_price
FROM products p
JOIN categories c ON p.category_id = c.category_id
JOIN order_items oi ON p.product_id = oi.product_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.status = 'completed'
    AND o.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
GROUP BY p.product_name, c.category_name
HAVING COUNT(oi.order_id) > 5
ORDER BY total_revenue DESC;`,
        explain: `+----+-------------+-------+-------+----------------------+----------------------+---------+------+--------+-----------------------------------------------------+
| id | select_type | table | type  | possible_keys        | key                  | key_len | ref  | rows   | Extra                                               |
+----+-------------+-------+-------+----------------------+----------------------+---------+------+--------+-----------------------------------------------------+
|  1 | SIMPLE      | o     | ALL   | PRIMARY,idx_status   | NULL                 | NULL    | NULL | 100000 | Using where; Using temporary; Using filesort       |
|  1 | SIMPLE      | oi    | ref   | PRIMARY,idx_product  | PRIMARY              | 4       | o.id |      5 | NULL                                                |
|  1 | SIMPLE      | p     | eq_ref| PRIMARY,idx_category | PRIMARY              | 4       | oi.p |      1 | NULL                                                |
|  1 | SIMPLE      | c     | eq_ref| PRIMARY,idx_name     | PRIMARY              | 4       | p.c  |      1 | NULL                                                |
+----+-------------+-------+-------+----------------------+----------------------+---------+------+--------+-----------------------------------------------------+`,
        tables: [
            ['categories', 'CREATE TABLE categories (category_id INT PRIMARY KEY, category_name VARCHAR(100) NOT NULL, description TEXT, parent_category_id INT REFERENCES categories(category_id));', '1000', '500KB', true, 'category_id', false, '', ''],
            ['products', 'CREATE TABLE products (product_id INT PRIMARY KEY, category_id INT NOT NULL REFERENCES categories(category_id), product_name VARCHAR(200) NOT NULL, description TEXT, unit_price DECIMAL(10,2) NOT NULL, weight DECIMAL(8,2), dimensions VARCHAR(50));', '10000', '5MB', true, 'product_id', true, 'category_id', 'categories'],
            ['customers', 'CREATE TABLE customers (customer_id INT PRIMARY KEY, email VARCHAR(255) NOT NULL, first_name VARCHAR(50), last_name VARCHAR(50), address TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);', '50000', '10MB', true, 'customer_id', false, '', ''],
            ['orders', 'CREATE TABLE orders (order_id INT PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(customer_id), status VARCHAR(20) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, shipped_at TIMESTAMP, total_amount DECIMAL(12,2));', '100000', '20MB', true, 'order_id', true, 'customer_id', 'customers'],
            ['order_items', 'CREATE TABLE order_items (order_id INT REFERENCES orders(order_id), product_id INT REFERENCES products(product_id), quantity INT NOT NULL, unit_price DECIMAL(10,2) NOT NULL, PRIMARY KEY (order_id, product_id));', '250000', '40MB', true, 'order_id,product_id', true, 'product_id', 'products']
        ],
        indexes: [
            ['idx_category_name', 'categories', 'CREATE INDEX idx_category_name ON categories(category_name);', '100KB'],
            ['idx_product_category', 'products', 'CREATE INDEX idx_product_category ON products(category_id);', '1MB'],
            ['idx_customer_email', 'customers', 'CREATE UNIQUE INDEX idx_customer_email ON customers(email);', '2MB'],
            ['idx_order_customer', 'orders', 'CREATE INDEX idx_order_customer ON orders(customer_id);', '4MB'],
            ['idx_order_status_date', 'orders', 'CREATE INDEX idx_order_status_date ON orders(status, created_at);', '5MB'],
            ['idx_order_items_product', 'order_items', 'CREATE INDEX idx_order_items_product ON order_items(product_id);', '8MB']
        ]
    },
    sqlserver: {
        sql: `SELECT 
    p.product_name,
    c.category_name,
    COUNT(oi.order_id) as order_count,
    SUM(oi.quantity * oi.unit_price) as total_revenue,
    AVG(oi.unit_price) as avg_price
FROM products p
JOIN categories c ON p.category_id = c.category_id
JOIN order_items oi ON p.product_id = oi.product_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.status = 'completed'
    AND o.created_at >= DATEADD(month, -6, GETDATE())
GROUP BY p.product_name, c.category_name
HAVING COUNT(oi.order_id) > 5
ORDER BY total_revenue DESC;`,
                        explain: `|--Sort(ORDER BY:([oi].[quantity]*[oi].[unit_price] DESC) (cost=0.0..150.0 rows=1000 width=0, io=500)
    |--Hash Match(Aggregate, HASH:([p].[product_name], [c].[category_name]), RESIDUAL:([p].[product_name] = [p].[product_name] AND [c].[category_name] = [c].[category_name])) (cost=0.0..200.0 rows=1000 width=0, io=800)
        |--Hash Match(Inner Join, HASH:([oi].[product_id])=([p].[product_id])) (cost=0.0..250.0 rows=5000 width=0, io=1200)
            |--Hash Match(Inner Join, HASH:([o].[order_id])=([oi].[order_id])) (cost=0.0..300.0 rows=10000 width=0, io=2000)
                |--Clustered Index Scan(OBJECT:([dbo].[orders].[PK_orders]), WHERE:([o].[status]='completed' AND [o].[created_at]>=DATEADD(month,(-6),GETDATE()))) (cost=0.0..100.0 rows=50000 width=0, io=1500)
                |--Clustered Index Scan(OBJECT:([dbo].[order_items].[PK_order_items])) (cost=0.0..150.0 rows=250000 width=0, io=3000)
            |--Hash Match(Inner Join, HASH:([p].[category_id])=([c].[category_id])) (cost=0.0..120.0 rows=10000 width=0, io=600)
                |--Clustered Index Scan(OBJECT:([dbo].[products].[PK_products])) (cost=0.0..80.0 rows=10000 width=0, io=400)
                |--Clustered Index Scan(OBJECT:([dbo].[categories].[PK_categories])) (cost=0.0..50.0 rows=1000 width=0, io=200)`,
        tables: [
            ['categories', 'CREATE TABLE categories (category_id INT PRIMARY KEY, category_name NVARCHAR(100) NOT NULL, description NVARCHAR(MAX), parent_category_id INT REFERENCES categories(category_id));', '1000', '500KB', true, 'category_id', false, '', ''],
            ['products', 'CREATE TABLE products (product_id INT PRIMARY KEY, category_id INT NOT NULL REFERENCES categories(category_id), product_name NVARCHAR(200) NOT NULL, description NVARCHAR(MAX), unit_price DECIMAL(10,2) NOT NULL, weight DECIMAL(8,2), dimensions NVARCHAR(50));', '10000', '5MB', true, 'product_id', true, 'category_id', 'categories'],
            ['orders', 'CREATE TABLE orders (order_id INT PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(customer_id), status NVARCHAR(20) NOT NULL, created_at DATETIME DEFAULT GETDATE(), shipped_at DATETIME, total_amount DECIMAL(12,2));', '100000', '20MB', true, 'order_id', true, 'customer_id', 'customers'],
            ['order_items', 'CREATE TABLE order_items (order_id INT REFERENCES orders(order_id), product_id INT REFERENCES products(product_id), quantity INT NOT NULL, unit_price DECIMAL(10,2) NOT NULL, CONSTRAINT PK_order_items PRIMARY KEY (order_id, product_id));', '250000', '40MB', true, 'order_id,product_id', true, 'product_id', 'products'],
            ['customers', 'CREATE TABLE customers (customer_id INT PRIMARY KEY, email NVARCHAR(255) NOT NULL, first_name NVARCHAR(50), last_name NVARCHAR(50), address NVARCHAR(MAX), created_at DATETIME DEFAULT GETDATE());', '50000', '10MB', true, 'customer_id', false, '', '']
        ],
        indexes: [
            ['idx_category_name', 'categories', 'CREATE INDEX idx_category_name ON categories(category_name);', '100KB'],
            ['idx_product_category', 'products', 'CREATE INDEX idx_product_category ON products(category_id);', '1MB'],
            ['idx_customer_email', 'customers', 'CREATE UNIQUE INDEX idx_customer_email ON customers(email);', '2MB'],
            ['idx_order_customer', 'orders', 'CREATE INDEX idx_order_customer ON orders(customer_id);', '4MB'],
            ['idx_order_status_date', 'orders', 'CREATE INDEX idx_order_status_date ON orders(status, created_at);', '5MB'],
            ['idx_order_items_product', 'order_items', 'CREATE INDEX idx_order_items_product ON order_items(product_id);', '8MB']
        ]
    },
    oracle: {
        sql: `WITH monthly_sales AS (
    SELECT 
        p.category_id,
        TRUNC(o.created_at, 'MM') as sale_month,
        SUM(oi.quantity * oi.unit_price) as total_sales,
        COUNT(DISTINCT o.customer_id) as unique_customers
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    WHERE o.status = 'completed'
    AND o.created_at >= ADD_MONTHS(TRUNC(SYSDATE), -12)
    GROUP BY p.category_id, TRUNC(o.created_at, 'MM')
),
category_rankings AS (
    SELECT 
        c.category_name,
        ms.sale_month,
        ms.total_sales,
        ms.unique_customers,
        RANK() OVER (PARTITION BY ms.sale_month ORDER BY ms.total_sales DESC) as sales_rank,
        LAG(ms.total_sales) OVER (PARTITION BY c.category_id ORDER BY ms.sale_month) as prev_month_sales
    FROM monthly_sales ms
    JOIN categories c ON ms.category_id = c.category_id
)
SELECT 
    cr.category_name,
    cr.sale_month,
    cr.total_sales,
    cr.unique_customers,
    cr.sales_rank,
    ROUND((cr.total_sales - cr.prev_month_sales) / NULLIF(cr.prev_month_sales, 0) * 100, 2) as sales_growth_pct,
    CASE WHEN EXISTS (
        SELECT 1 
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN categories c ON p.category_id = c.category_id
        WHERE c.category_name = cr.category_name
        AND i.stock_level < i.reorder_point
    ) THEN 1 ELSE 0 END as needs_restock
FROM category_rankings cr
WHERE cr.sales_rank <= 5
ORDER BY cr.sale_month DESC, cr.sales_rank`,
        explain: `Plan hash value: 3849392136

------------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name            | Rows  | Bytes | Cost (%CPU)| Time     | Pstart| Pstop |
------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |                 |    50 |  9700 | 25438  (1)| 00:00:01 |       |       |
|   1 |  SORT ORDER BY               |                 |    50 |  9700 |  2540  (1)| 00:00:01 |       |       |
|   2 |   VIEW                       |                 |    50 |  9700 |  2539  (1)| 00:00:01 |       |       |
|*  3 |    WINDOW SORT PUSHED RANK   |                 |  1000 | 48000 |  2539  (1)| 00:00:01 |       |       |
|   4 |     HASH JOIN               |                 |  1000 | 48000 |  2538  (1)| 00:00:01 |       |       |
|   5 |      TABLE ACCESS FULL      | CATEGORIES      |  1000 | 20000 |    20  (0)| 00:00:01 |       |       |
|   6 |      VIEW                   |                 |  1000 | 28000 |  2517  (1)| 00:00:01 |       |       |
|   7 |       HASH GROUP BY         |                 |  1000 | 36000 |  2517  (1)| 00:00:01 |       |       |
|   8 |        HASH JOIN           |                 | 25000 |  900K |  2466  (1)| 00:00:01 |       |       |
|   9 |         HASH JOIN          |                 | 25000 |  700K |  1514  (1)| 00:00:01 |       |       |
|  10 |          TABLE ACCESS FULL | ORDERS          | 25000 |  500K |   515  (1)| 00:00:01 |       |       |
|  11 |          TABLE ACCESS FULL | ORDER_ITEMS     |100000 |  2600K|   998  (1)| 00:00:01 |       |       |
|  12 |         TABLE ACCESS FULL  | PRODUCTS        | 10000 |  200K |   952  (1)| 00:00:01 |       |       |
------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   3 - filter("CR"."SALES_RANK"<=5)`,
        tables: [
            ['categories', 'CREATE TABLE categories (category_id NUMBER PRIMARY KEY, category_name VARCHAR2(100) NOT NULL, description CLOB, parent_category_id NUMBER REFERENCES categories(category_id));', '1000', '500KB', true, 'category_id', false, '', ''],
            ['products', 'CREATE TABLE products (product_id NUMBER PRIMARY KEY, category_id NUMBER NOT NULL REFERENCES categories(category_id), product_name VARCHAR2(200) NOT NULL, description CLOB, unit_price NUMBER(10,2) NOT NULL, weight NUMBER(8,2), dimensions VARCHAR2(50));', '10000', '5MB', true, 'product_id', true, 'category_id', 'categories'],
            ['customers', 'CREATE TABLE customers (customer_id NUMBER PRIMARY KEY, email VARCHAR2(255) NOT NULL, first_name VARCHAR2(50), last_name VARCHAR2(50), address CLOB, created_at TIMESTAMP DEFAULT SYSTIMESTAMP);', '50000', '10MB', true, 'customer_id', false, '', ''],
            ['orders', 'CREATE TABLE orders (order_id NUMBER PRIMARY KEY, customer_id NUMBER NOT NULL REFERENCES customers(customer_id), status VARCHAR2(20) NOT NULL, created_at TIMESTAMP DEFAULT SYSTIMESTAMP, shipped_at TIMESTAMP, total_amount NUMBER(12,2));', '100000', '20MB', true, 'order_id', true, 'customer_id', 'customers'],
            ['order_items', 'CREATE TABLE order_items (order_id NUMBER REFERENCES orders(order_id), product_id NUMBER REFERENCES products(product_id), quantity NUMBER NOT NULL, unit_price NUMBER(10,2) NOT NULL, CONSTRAINT pk_order_items PRIMARY KEY (order_id, product_id));', '250000', '40MB', true, 'order_id,product_id', true, 'product_id', 'products'],
            ['inventory', 'CREATE TABLE inventory (product_id NUMBER PRIMARY KEY REFERENCES products(product_id), warehouse_id NUMBER NOT NULL, stock_level NUMBER NOT NULL, reorder_point NUMBER NOT NULL, last_restock_date TIMESTAMP);', '10000', '2MB', true, 'product_id', false, '', '']
        ],
        indexes: [
            ['idx_category_name', 'categories', 'CREATE INDEX idx_category_name ON categories(category_name);', '100KB'],
            ['idx_product_category', 'products', 'CREATE INDEX idx_product_category ON products(category_id);', '1MB'],
            ['idx_customer_email', 'customers', 'CREATE UNIQUE INDEX idx_customer_email ON customers(email);', '2MB'],
            ['idx_order_customer', 'orders', 'CREATE INDEX idx_order_customer ON orders(customer_id);', '4MB'],
            ['idx_order_status_date', 'orders', 'CREATE INDEX idx_order_status_date ON orders(status, created_at);', '5MB'],
            ['idx_order_items_product', 'order_items', 'CREATE INDEX idx_order_items_product ON order_items(product_id);', '8MB'],
            ['idx_inventory_stock', 'inventory', 'CREATE INDEX idx_inventory_stock ON inventory(stock_level) WHERE stock_level < reorder_point;', '500KB']
        ]
    },
    sqlite: {
        sql: `SELECT 
    p.product_name,
    c.category_name,
    COUNT(oi.order_id) as order_count,
    SUM(oi.quantity * oi.unit_price) as total_revenue,
    AVG(oi.unit_price) as avg_price
FROM products p
JOIN categories c ON p.category_id = c.category_id
JOIN order_items oi ON p.product_id = oi.product_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.status = 'completed'
    AND o.created_at >= datetime('now', '-6 months')
GROUP BY p.product_name, c.category_name
HAVING COUNT(oi.order_id) > 5
ORDER BY total_revenue DESC;`,
        explain: `QUERY PLAN
SEARCH TABLE orders USING INDEX idx_order_status_date (status=? AND created_at>=?)
SCAN TABLE order_items
SEARCH TABLE products USING INTEGER PRIMARY KEY (rowid=?)
SEARCH TABLE categories USING INTEGER PRIMARY KEY (rowid=?)
USE TEMP B-TREE FOR GROUP BY
USE TEMP B-TREE FOR ORDER BY`,
        tables: [
            ['categories', 'CREATE TABLE categories (category_id INTEGER PRIMARY KEY, category_name TEXT NOT NULL, description TEXT, parent_category_id INTEGER REFERENCES categories(category_id));', '1000', '500KB', true, 'category_id', false, '', ''],
            ['products', 'CREATE TABLE products (product_id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories(category_id), product_name TEXT NOT NULL, description TEXT, unit_price REAL NOT NULL, weight REAL, dimensions TEXT);', '10000', '5MB', true, 'product_id', true, 'category_id', 'categories'],
            ['customers', 'CREATE TABLE customers (customer_id INTEGER PRIMARY KEY, email TEXT NOT NULL, first_name TEXT, last_name TEXT, address TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);', '50000', '10MB', true, 'customer_id', false, '', ''],
            ['orders', 'CREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(customer_id), status TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, shipped_at TEXT, total_amount REAL);', '100000', '20MB', true, 'order_id', true, 'customer_id', 'customers'],
            ['order_items', 'CREATE TABLE order_items (order_id INTEGER REFERENCES orders(order_id), product_id INTEGER REFERENCES products(product_id), quantity INTEGER NOT NULL, unit_price REAL NOT NULL, PRIMARY KEY (order_id, product_id));', '250000', '40MB', true, 'order_id,product_id', true, 'product_id', 'products']
        ],
        indexes: [
            ['idx_category_name', 'categories', 'CREATE INDEX idx_category_name ON categories(category_name);', '100KB'],
            ['idx_product_category', 'products', 'CREATE INDEX idx_product_category ON products(category_id);', '1MB'],
            ['idx_customer_email', 'customers', 'CREATE UNIQUE INDEX idx_customer_email ON customers(email);', '2MB'],
            ['idx_order_customer', 'orders', 'CREATE INDEX idx_order_customer ON orders(customer_id);', '4MB'],
            ['idx_order_status_date', 'orders', 'CREATE INDEX idx_order_status_date ON orders(status, created_at);', '5MB'],
            ['idx_order_items_product', 'order_items', 'CREATE INDEX idx_order_items_product ON order_items(product_id);', '8MB']
        ]
    }
};

// Helper function to calculate plan complexity
function calculatePlanComplexity(treeData) {
    let complexity = 0;
    
    function traverse(node) {
        complexity += 1;
        if (node.children) {
            node.children.forEach(traverse);
        }
    }
    
    traverse(treeData);
    return complexity;
}

function loadSampleData() {
    // 1. Detect selected DB engine
    const dbEngine = document.getElementById('db_engine_select').value;

    // 2. Get sample data for the selected engine
    let sample = engineSamples[dbEngine];
    
    // Handle unknown engine
    if (!sample) {
        const feedback = document.getElementById('sql_query_feedback');
        if (feedback) {
            feedback.innerHTML = `No sample data available for ${dbEngine}. Using PostgreSQL sample data instead.`;
            feedback.style.color = '#f59e0b';
            feedback.setAttribute('aria-live', 'polite');
        }
        // Default to PostgreSQL sample data
        sample = engineSamples['postgresql'];
    }

    // 3. Set SQL Query
    document.getElementById('sql_query_textarea').value = sample.sql;
    
    // 4. Set EXPLAIN plan
    document.getElementById('explain_plan_textarea').value = sample.explain;
    
    // 5. Clear and add sample tables
    const tablesContainer = document.getElementById('tables-container');
    tablesContainer.innerHTML = '';
    sample.tables.forEach(args => addTable(...args));
    
    // 6. Clear and add sample indexes
    const indexesContainer = document.getElementById('indexes-container');
    indexesContainer.innerHTML = '';
    sample.indexes.forEach(args => addIndex(...args));
    
    // 7. Trigger validation and tooltips
    if (window.bootstrap && bootstrap.Tooltip) {
        var newInputs = document.querySelectorAll('[title]');
        newInputs.forEach(function (el) {
            new bootstrap.Tooltip(el);
        });
    }
    
    // 8. Trigger validation for SQL and EXPLAIN
    if (typeof update === 'function') update(reserved_words);
    if (typeof validateExplain === 'function') validateExplain();
    
    // 9. Announce to screen readers
    const feedback = document.getElementById('sql_query_feedback');
    if (feedback) {
        feedback.innerHTML = `Sample data loaded for ${dbEngine.toUpperCase()}.`;
        feedback.style.color = '#22c55e';
        feedback.setAttribute('aria-live', 'polite');
        
        // Clear feedback after 3 seconds
        setTimeout(() => {
            feedback.innerHTML = '';
            feedback.style.color = '';
        }, 3000);
    }
    
    // 10. Add ARIA live region for screen readers
    const ariaAnnouncement = document.createElement('div');
    ariaAnnouncement.setAttribute('role', 'status');
    ariaAnnouncement.setAttribute('aria-live', 'polite');
    ariaAnnouncement.className = 'visually-hidden';
    ariaAnnouncement.textContent = `Sample data for ${dbEngine.toUpperCase()} has been loaded. The query analyzes user order counts with tables and indexes.`;
    document.body.appendChild(ariaAnnouncement);
    setTimeout(() => document.body.removeChild(ariaAnnouncement), 3000);
}

        function renderD3Tree(treeData, container) {
            console.log("renderD3Tree called with:", {treeData, container});
            
            // Calculate plan complexity to determine visualization type
            const planComplexity = calculatePlanComplexity(treeData);
            console.log("Plan complexity:", planComplexity);
            
            // Use compact mode for very complex plans (≥20 nodes) - increased threshold
            if (planComplexity >= 20) {
                console.log("Using compact tree rendering");
                renderCompactTree(treeData, container);
                return;
            }
            
            // Use detailed mode for simple and moderately complex plans (≤19 nodes)
            console.log("Using detailed tree rendering");
            renderDetailedTree(treeData, container);
        }

        // Global functions for visualization controls
        function resetZoom() {
            const container = document.getElementById('d3-visualization');
            if (container) {
                const svg = d3.select(container).select("svg");
                if (svg.empty()) return;
                
                const contentGroup = svg.select("g");
                if (contentGroup.empty()) return;
                
                // Get the existing zoom behavior
                const zoom = svg.attr("data-zoom");
                if (!zoom) return;
                
                // Calculate proper fit to screen with margins
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;
                
                // Get the actual content bounds
                const renderedBounds = contentGroup.node().getBBox();
                
                // Calculate the scale to fit the tree in the container with margins
                const margin = {left: 50, right: 50, top: 50, bottom: 50};
                const availableWidth = containerWidth - margin.left - margin.right;
                const availableHeight = containerHeight - margin.top - margin.bottom;
                const scaleX = availableWidth / Math.max(renderedBounds.width, 1);
                const scaleY = availableHeight / Math.max(renderedBounds.height, 1);
                const initialScale = Math.min(scaleX, scaleY, 0.8); // Don't scale up, only down
                
                // Calculate the translation to center the tree within available space
                const centerX = (containerWidth - renderedBounds.width * initialScale) / 2 - renderedBounds.x * initialScale;
                const centerY = (containerHeight - renderedBounds.height * initialScale) / 2 - renderedBounds.y * initialScale;
                
                // Apply the reset transform using the existing zoom behavior
                const resetTransform = d3.zoomIdentity
                    .translate(centerX, centerY)
                    .scale(initialScale);
                
                svg.call(zoom.transform, resetTransform);
            }
        }

        function toggleMetrics() {
            const container = document.getElementById('d3-visualization');
            if (container) {
                            const metricsElements = container.querySelectorAll('.metrics, .performance-indicators, .metrics-compact, .performance-indicators-compact');
            metricsElements.forEach(el => {
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            });
            }
        }

// Store EXPLAIN plan data for results page visualization
function storeExplainPlanData() {
    const explainText = document.getElementById('explain_plan_textarea')?.value || '';
    const dbEngine = document.getElementById('db_engine_select')?.value || 'postgresql';
    
    if (explainText) {
        sessionStorage.setItem('explain_plan_text', explainText);
        sessionStorage.setItem('db_engine', dbEngine);
    }
}

// Add event listener to store data when form is submitted
document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form[action="/analyze"]');
    if (form) {
        form.addEventListener('submit', storeExplainPlanData);
    }
});


