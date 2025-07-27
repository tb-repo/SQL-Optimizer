// Always use |tojson for any template variable injected into JavaScript to avoid HTML entity issues.
console.log('scripts.js loaded');
window.loadSampleData = function() {
    const dbEngine = document.getElementById('db-engine') ? document.getElementById('db-engine').value.toLowerCase() : null;
    if (!dbEngine || typeof SAMPLE_DATA === 'undefined' || !SAMPLE_DATA[dbEngine]) {
        showToast('No sample data available for this database engine.', 'error');
        return;
    }
    const data = SAMPLE_DATA[dbEngine];
    // SQL Query
    var sqlInput = document.getElementById('sql_query');
    if (sqlInput) {
        sqlInput.value = data.sql_query || data.query || '';
    }
    // EXPLAIN Plan
    var explainInput = document.getElementById('explain_plan_textarea');
    if (explainInput) {
        explainInput.value = data.explain || data.explainPlan || '';
    }
    // Tables
    var tableContainer = document.getElementById('tables-container');
    if (tableContainer) tableContainer.innerHTML = '';
    if (data.tables && Array.isArray(data.tables)) {
        data.tables.forEach(function(table, idx) {
            const tmpl = document.getElementById('table-entry-template');
            if (!tmpl) return;
            const clone = tmpl.content.cloneNode(true);
            // Set unique names/IDs for each table
            clone.querySelectorAll('[name]').forEach(el => {
                el.name = el.name.replace('{i}', idx);
                if (el.id) el.id = el.id.replace('{i}', idx);
            });
            // Fill fields
            clone.querySelector(`[name="table_name_${idx}"]`).value = table.name || '';
            clone.querySelector(`[name="table_rows_${idx}"]`).value = table.rows || '';
            clone.querySelector(`[name="table_ddl_${idx}"]`).value = table.ddl || '';
            clone.querySelector(`[name="table_size_${idx}"]`).value = table.size || (table.rows ? (parseInt(table.rows,10)*100).toString() + ' MB' : '10000 MB');
            // Set tooltips
            clone.querySelector(`[name="table_name_${idx}"]`).title = 'Name of the table.';
            clone.querySelector(`[name="table_rows_${idx}"]`).title = 'Estimated number of rows in the table.';
            clone.querySelector(`[name="table_ddl_${idx}"]`).title = 'CREATE TABLE statement for this table.';
            clone.querySelector(`[name="table_size_${idx}"]`).title = 'Enter the estimated size of the table. Supports units: bytes, KB, MB, GB, TB.';
            // Primary key
            let pkCheck = clone.querySelector(`[name="table_has_primary_${idx}"]`);
            let pkGroup = clone.querySelector(`#primary_key_group_${idx}`);
            let pkInput = clone.querySelector(`[name="table_primary_key_${idx}"]`);
            if (pkCheck && pkInput && pkGroup) {
                pkCheck.checked = !!table.has_primary_key;
                pkInput.value = table.primary_key_column || table.primaryKey || '';
                pkGroup.style.display = pkCheck.checked ? '' : 'none';
                pkCheck.addEventListener('change', function() {
                    pkGroup.style.display = this.checked ? '' : 'none';
                });
                pkCheck.title = 'Check if this table has a primary key.';
                pkInput.title = 'Primary key column(s) for this table.';
            }
            // Foreign key
            let fkCheck = clone.querySelector(`[name="table_has_foreign_${idx}"]`);
            let fkGroup = clone.querySelector(`#foreign_key_group_${idx}`);
            let fkColInput = clone.querySelector(`[name="table_foreign_key_${idx}"]`);
            let fkTableInput = clone.querySelector(`[name="table_foreign_table_${idx}"]`);
            if (fkCheck && fkColInput && fkTableInput && fkGroup) {
                fkCheck.checked = !!table.has_foreign_key;
                fkColInput.value = table.foreign_key_column || table.foreignKeys || '';
                fkTableInput.value = table.foreign_key_table || '';
                fkGroup.style.display = fkCheck.checked ? '' : 'none';
                fkCheck.addEventListener('change', function() {
                    fkGroup.style.display = this.checked ? '' : 'none';
                });
                fkCheck.title = 'Check if this table has a foreign key.';
                fkColInput.title = 'Foreign key column(s) for this table.';
                fkTableInput.title = 'Referenced table for the foreign key.';
            }
            // Remove button
            clone.querySelector('.remove-table-btn').addEventListener('click', function() {
                this.closest('.table-entry').remove();
            });
            tableContainer.appendChild(clone);
        });
    }
    // Indexes
    var indexContainer = document.getElementById('indexes-container');
    if (indexContainer) indexContainer.innerHTML = '';
    if (data.indexes && Array.isArray(data.indexes)) {
        data.indexes.forEach(function(index, idx) {
            const tmpl = document.getElementById('index-entry-template');
            if (!tmpl) return;
            const clone = tmpl.content.cloneNode(true);
            // Set unique names/IDs for each index
            clone.querySelectorAll('[name]').forEach(el => {
                el.name = el.name.replace('{i}', idx);
                if (el.id) el.id = el.id.replace('{i}', idx);
            });
            // Fill fields
            clone.querySelector(`[name="index_name_${idx}"]`).value = index.name || '';
            clone.querySelector(`[name="index_table_${idx}"]`).value = index.table || '';
            clone.querySelector(`[name="index_def_${idx}"]`).value = index.definition || index.ddl || '';
            clone.querySelector(`[name="index_size_${idx}"]`).value = (index.size || '1000') + ' MB';
            // Set tooltips
            clone.querySelector(`[name="index_name_${idx}"]`).title = 'Name of the index.';
            clone.querySelector(`[name="index_table_${idx}"]`).title = 'Name of the table this index is on.';
            clone.querySelector(`[name="index_def_${idx}"]`).title = 'CREATE INDEX statement for this index.';
            clone.querySelector(`[name="index_size_${idx}"]`).title = 'Enter the estimated size of the index. Supports units: bytes, KB, MB, GB, TB.';
            // Remove button
            clone.querySelector('.remove-index-btn').addEventListener('click', function() {
                this.closest('.index-entry').remove();
            });
            indexContainer.appendChild(clone);
        });
    }
    // Remove auto-generate after sample data load
    // generateExplainVisualization(); // <-- REMOVE this line after sample data load
};
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
// --- TIPS ---
let currentTipIndex = 0;
const tipUpdateInterval = 10000;
function updateTip() {
    const dbEngine = document.getElementById('db-engine');
    const tipText = document.getElementById('engine-tips-content');
    const engineLabel = document.getElementById('engine-tips-engine');
    if (!dbEngine || !tipText || !engineLabel || typeof window.engineTips === 'undefined') {
        console.log('Tips: Required elements or engineTips missing', {dbEngine, tipText, engineLabel, engineTips: typeof window.engineTips});
        return;
    }
    const currentEngine = dbEngine.value.toLowerCase();
    const tips = window.engineTips[currentEngine] || [];
    if (tips.length > 0) {
        tipText.textContent = tips[currentTipIndex];
        engineLabel.textContent = currentEngine.toUpperCase();
        currentTipIndex = (currentTipIndex + 1) % tips.length;
    } else {
        tipText.textContent = 'No tips available for this engine.';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // TIPS
    const dbEngine = document.getElementById('db-engine');
    const tipText = document.getElementById('engine-tips-content');
    const engineLabel = document.getElementById('engine-tips-engine');
    if (dbEngine && tipText && engineLabel) {
        currentTipIndex = 0;
        updateTip();
        setInterval(updateTip, tipUpdateInterval);
        dbEngine.addEventListener('change', function() {
            currentTipIndex = 0;
            updateTip();
        });
    }
    // BUTTONS
    document.getElementById('load-sample-btn')?.addEventListener('click', loadSampleData);
    document.getElementById('generate-viz-btn')?.addEventListener('click', function(e) {
        e.preventDefault();
        generateExplainVisualization();
    });
    document.getElementById('csvHelpModalBtn')?.addEventListener('click', generateCSVHelpContent);
    document.getElementById('add-table-btn')?.addEventListener('click', addTable);
    document.getElementById('add-index-btn')?.addEventListener('click', addIndex);
    document.getElementById('beautify-sql-btn')?.addEventListener('click', beautifySQL);
    document.getElementById('how-to-generate-btn')?.addEventListener('click', showHowToGenerate);
    document.getElementById('upload-table-btn')?.addEventListener('click', function() {
        document.getElementById('csv-table-upload').click();
    });
    document.getElementById('upload-index-btn')?.addEventListener('click', function() {
        document.getElementById('csv-index-upload').click();
    });
    document.getElementById('upload-explain-btn')?.addEventListener('click', function() {
        document.getElementById('explain_file').click();
    });
    // Remove Table/Index event delegation
    document.getElementById('tables-container')?.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-table-btn')) {
            e.target.closest('.table-entry').remove();
        }
    });
    document.getElementById('indexes-container')?.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-index-btn')) {
            e.target.closest('.index-entry').remove();
        }
    });
});

function initializeTips() {
    // Get tips from the global engineTips variable (loaded from tips.js)
    if (typeof window.engineTips !== 'undefined') {
        updateEngineTips();
        startTipsRotation();
    } else {
        console.error('Tips not loaded: engineTips is undefined');
    }
}

function updateEngineTips() {
    const engineSelect = document.getElementById('db_engine_select');
    const tipsContainer = document.getElementById('engine-tips-content');
    const engineNameSpan = document.getElementById('engine-tips-engine');
    
    if (!engineSelect || !tipsContainer || !engineNameSpan) {
        console.error('Required elements for tips not found:', {
            engineSelect: !!engineSelect,
            tipsContainer: !!tipsContainer,
            engineNameSpan: !!engineNameSpan
        });
        return;
    }
    
    const selectedEngine = engineSelect.value;
    const tips = window.engineTips[selectedEngine] || [];
    
    if (tips.length > 0) {
        // Update engine name
        engineNameSpan.textContent = selectedEngine.toUpperCase();
        
        // Show first tip
        currentTipIndex = 0;
        showCurrentTip();
        
        // Reset progress bar
        resetProgressBar();
    } else {
        console.warn('No tips found for engine:', selectedEngine);
    }
}

function showCurrentTip() {
    const engineSelect = document.getElementById('db_engine_select');
    const tipsContainer = document.getElementById('engine-tips-content');
    
    if (!engineSelect || !tipsContainer) {
        console.error('Required elements for showing tip not found');
        return;
    }
    
    const selectedEngine = engineSelect.value;
    const tips = window.engineTips[selectedEngine] || [];
    
    if (tips.length > 0) {
        const tipText = tips[currentTipIndex];
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
        progressBar.style.animation = 'progress-fill 15s linear';
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

    // Read as text file instead of CSV
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const explainText = e.target.result;
            document.getElementById('explain_plan_textarea').value = explainText;
            
            // Show success message
            const feedback = document.getElementById('explain_plan_feedback');
            if (feedback) {
                feedback.innerHTML = `<i class="fas fa-check text-success me-1"></i>EXPLAIN plan loaded successfully! The visualization will be generated when you analyze the query.`;
                feedback.style.color = '#22c55e';
                feedback.setAttribute('aria-live', 'polite');
            }
        } catch (err) {
            alert('Error reading EXPLAIN plan file: ' + err.message);
        }
    };
    reader.onerror = function() {
        alert('Error reading file');
    };
    reader.readAsText(file);
}

function populateCSVHelpModal() {
    const helpContent = document.getElementById('csv-help-content');
    if (!helpContent) return;
    const sqlInput = document.getElementById('sql_query');
    const dbEngineSelect = document.getElementById('db-engine');
    if (!sqlInput || !dbEngineSelect) return;
    const sql = sqlInput.value.trim();
    const dbEngine = dbEngineSelect.value;
    // Extract table names from SQL
    const tableNames = extractTableNames(sql);
    // Extract indexes from DOM
    const indexContainer = document.getElementById('indexes-container');
    const indexes = Array.from(indexContainer ? indexContainer.querySelectorAll('.index-entry') : []).map(entry => {
        const nameInput = entry.querySelector('input[placeholder="Index Name"]');
        const tableInput = entry.querySelector('input[placeholder="Table Name"]');
        return {
            name: nameInput ? nameInput.value : '',
            table: tableInput ? tableInput.value : ''
        };
    });
    // Generate help content
    let content = `
        <div class="csv-help-section mb-4">
            <h5><i class="fas fa-table me-2"></i>Table Information CSV Format</h5>
            <p>Create a CSV file with the following columns:</p>
            <ul>
                <li><code>table_name</code>: Name of the table</li>
                <li><code>ddl</code>: CREATE TABLE statement</li>
                <li><code>row_count</code>: Number of rows in the table</li>
                <li><code>has_primary_key</code>: true/false</li>
                <li><code>primary_key_column</code>: Name of primary key column</li>
                <li><code>has_foreign_key</code>: true/false</li>
                <li><code>foreign_key_column</code>: Name of foreign key column</li>
                <li><code>foreign_key_table</code>: Referenced table name</li>
            </ul>
            ${tableNames.length > 0 ? `
                <div class="alert alert-info">
                    <strong>Detected Tables:</strong> ${tableNames.join(', ')}
                </div>
            ` : ''}
        </div>
`;
    // --- Combined SQLs for all tables ---
    if (tableNames.length > 0) {
        const engine = dbEngine && dbEngine.toLowerCase();
        // Row count
        let rowCountSQL = '';
        // DDL
        let ddlSQL = '';
        // Size
        let sizeSQL = '';
        // Primary key
        let pkSQL = '';
        // Foreign key
        let fkSQL = '';
        // Index details
        let indexSQL = '';
        // EXPLAIN plan
        let explainSQL = '';
        if (engine === 'postgresql') {
            rowCountSQL = `SELECT table_name, reltuples::bigint AS row_count FROM pg_class WHERE relname IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            ddlSQL = `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            sizeSQL = `SELECT relname AS table_name, pg_size_pretty(pg_total_relation_size(relid)) AS total_size FROM pg_catalog.pg_statio_user_tables WHERE relname IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            pkSQL = `SELECT tc.table_name, kcu.column_name AS primary_key_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            fkSQL = `SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            indexSQL = `SELECT tablename, indexname, indexdef, pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size FROM pg_indexes WHERE tablename IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            explainSQL = sql ? `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)\n${sql}` : '';
        } else if (engine === 'mysql') {
            rowCountSQL = `SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            ddlSQL = `SHOW CREATE TABLE ${tableNames.join('; SHOW CREATE TABLE ')};`;
            sizeSQL = `SELECT table_name, ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_mb FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            pkSQL = `SELECT table_name, column_name FROM information_schema.key_column_usage WHERE constraint_name = 'PRIMARY' AND table_name IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            fkSQL = `SELECT table_name, column_name, referenced_table_name, referenced_column_name FROM information_schema.key_column_usage WHERE referenced_table_name IS NOT NULL AND table_name IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            indexSQL = `SHOW INDEX FROM ${tableNames.join('; SHOW INDEX FROM ')};`;
            explainSQL = sql ? `EXPLAIN\n${sql}` : '';
        } else if (engine === 'oracle') {
            rowCountSQL = `SELECT table_name, num_rows FROM user_tables WHERE table_name IN (${tableNames.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
            ddlSQL = tableNames.map(t => `SELECT dbms_metadata.get_ddl('TABLE', '${t.toUpperCase()}') FROM dual`).join(' UNION ALL ');
            sizeSQL = `SELECT segment_name AS table_name, bytes/1024/1024 AS size_mb FROM user_segments WHERE segment_type = 'TABLE' AND segment_name IN (${tableNames.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
            pkSQL = `SELECT cols.table_name, cols.column_name FROM all_constraints cons, all_cons_columns cols WHERE cons.constraint_type = 'P' AND cons.constraint_name = cols.constraint_name AND cols.table_name IN (${tableNames.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
            fkSQL = `SELECT a.table_name, a.column_name, c_pk.table_name AS foreign_table_name, b.column_name AS foreign_column_name FROM user_cons_columns a JOIN user_constraints c ON a.constraint_name = c.constraint_name JOIN user_constraints c_pk ON c.r_constraint_name = c_pk.constraint_name JOIN user_cons_columns b ON b.constraint_name = c_pk.constraint_name AND b.position = a.position WHERE c.constraint_type = 'R' AND a.table_name IN (${tableNames.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
            indexSQL = `SELECT index_name, table_name, column_name, bytes/1024/1024 AS index_size_mb FROM user_indexes JOIN user_ind_columns USING(index_name, table_name) JOIN user_segments ON user_indexes.index_name = user_segments.segment_name WHERE table_name IN (${tableNames.map(t => `'${t.toUpperCase()}'`).join(', ')});`;
            explainSQL = sql ? `EXPLAIN PLAN FOR\n${sql}\nSELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);` : '';
        } else if (engine === 'sql server' || engine === 'sqlserver' || engine === 'mssql') {
            rowCountSQL = `SELECT t.name AS table_name, SUM(p.rows) AS row_count FROM sys.tables t JOIN sys.partitions p ON t.object_id = p.object_id WHERE t.name IN (${tableNames.map(t => `'${t}'`).join(', ')}) GROUP BY t.name;`;
            ddlSQL = tableNames.map(t => `sp_help '${t}'`).join('; ');
            sizeSQL = `SELECT t.name AS table_name, SUM(a.total_pages) * 8 AS total_kb FROM sys.tables t JOIN sys.indexes i ON t.object_id = i.object_id JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id JOIN sys.allocation_units a ON p.partition_id = a.container_id WHERE t.name IN (${tableNames.map(t => `'${t}'`).join(', ')}) GROUP BY t.name;`;
            pkSQL = `SELECT t.name AS table_name, c.name AS primary_key_column FROM sys.tables t JOIN sys.indexes i ON t.object_id = i.object_id AND i.is_primary_key = 1 JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id JOIN sys.columns c ON t.object_id = c.object_id AND ic.column_id = c.column_id WHERE t.name IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            fkSQL = `SELECT f.name AS foreign_key_name, OBJECT_NAME(f.parent_object_id) AS table_name, COL_NAME(fc.parent_object_id, fc.parent_column_id) AS column_name, OBJECT_NAME (f.referenced_object_id) AS referenced_table_name, COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS referenced_column_name FROM sys.foreign_keys AS f INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id WHERE OBJECT_NAME(f.parent_object_id) IN (${tableNames.map(t => `'${t}'`).join(', ')});`;
            indexSQL = `SELECT t.name AS table_name, ind.name AS index_name, col.name AS column_name, SUM(a.total_pages) * 8 AS index_size_kb FROM sys.indexes ind JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id JOIN sys.tables t ON ind.object_id = t.object_id JOIN sys.allocation_units a ON ind.object_id = a.container_id WHERE t.name IN (${tableNames.map(t => `'${t}'`).join(', ')}) GROUP BY t.name, ind.name, col.name;`;
            explainSQL = sql ? `SET SHOWPLAN_ALL ON;\n${sql}\nSET SHOWPLAN_ALL OFF;` : '';
        }
        content += `
        <div class="csv-help-section mb-4">
            <h5><i class="fas fa-database me-2"></i>Combined SQL Queries for All Tables</h5>
            <div class="mb-2"><strong>Row Count:</strong><pre>${rowCountSQL}</pre></div>
            <div class="mb-2"><strong>DDL/Schema:</strong><pre>${ddlSQL}</pre></div>
            <div class="mb-2"><strong>Table Size:</strong><pre>${sizeSQL}</pre></div>
            <div class="mb-2"><strong>Primary Key:</strong><pre>${pkSQL}</pre></div>
            <div class="mb-2"><strong>Foreign Key:</strong><pre>${fkSQL}</pre></div>
            <div class="mb-2"><strong>Indexes:</strong><pre>${indexSQL}</pre></div>
            <div class="mb-2"><strong>EXPLAIN Plan:</strong><pre>${explainSQL}</pre></div>
        </div>
    `;
    }
    helpContent.innerHTML = content;
}

// --- Utility Functions ---
function showToast(message, type) {
    // Simple fallback toast
    alert(message);
}
function zoomIn() { showToast('Zoom In not implemented', 'info'); }
function zoomOut() { showToast('Zoom Out not implemented', 'info'); }
function resetZoom() { showToast('Reset Zoom not implemented', 'info'); }
// Implement downloadSVG to download the SVG as a file
function downloadSVG() {
    const svg = document.querySelector('#visualization_container svg');
    if (!svg) {
        showToast('No visualization to download.', 'error');
            return;
        }
    // Clone and serialize SVG
    const clone = svg.cloneNode(true);
    // Remove pan/zoom handlers if present
    clone.removeAttribute('style');
    // Set background white for export
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#fff');
    clone.insertBefore(bg, clone.firstChild);
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);
    // Add XML declaration
    if (!source.match(/^<\?xml/)) {
        source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    }
    // Download as file
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'explain_plan.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
// Attach to button
const downloadBtn = document.getElementById('download-svg-btn');
if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadSVG);
}

// --- Visualization Toolbar Setup ---
function setupVisualizationToolbar(panzoomInstance) {
    document.getElementById('zoom-in-btn')?.addEventListener('click', function() {
        if (panzoomInstance && typeof panzoomInstance.zoomIn === 'function') panzoomInstance.zoomIn();
    });
    document.getElementById('zoom-out-btn')?.addEventListener('click', function() {
        if (panzoomInstance && typeof panzoomInstance.zoomOut === 'function') panzoomInstance.zoomOut();
    });
    document.getElementById('reset-zoom-btn')?.addEventListener('click', function() {
        if (panzoomInstance && typeof panzoomInstance.fit === 'function' && typeof panzoomInstance.center === 'function') {
            panzoomInstance.fit();
            panzoomInstance.center();
        }
    });
    document.getElementById('download-svg-btn')?.addEventListener('click', function() {
        const svg = document.querySelector('#visualization_container svg');
        if (svg) {
            const serializer = new XMLSerializer();
            const source = serializer.serializeToString(svg);
            const blob = new Blob([source], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'explain_plan.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });
}

function applyNodeStylesToSVG(svg, dbEngine) {
    if (!svg || !dbEngine) return;
    dbEngine = dbEngine.toLowerCase();
    const config = engineConfig[dbEngine];
    if (!config || !config.planNodeStyles) return;
    const styles = config.planNodeStyles;
    const nodes = svg.querySelectorAll('g.node');
    nodes.forEach(node => {
        const label = (node.textContent || '').trim();
        let matched = false;
        for (const [key, style] of Object.entries(styles)) {
            // Case-insensitive, partial match, trim whitespace
            if (label.toLowerCase().includes(key.toLowerCase().trim())) {
                const shape = node.querySelector('ellipse, rect, polygon, path');
                if (shape && style.color) {
                    shape.setAttribute('fill', style.color);
                    matched = true;
                    console.log(`[DEBUG] Colored node '${label}' as '${key}' with color ${style.color}`);
                }
            break;
    }
        }
        if (!matched) {
            console.log(`[DEBUG] No style match for node label: '${label}'`);
        }
    });
    // Update selector to match both types
    svg.querySelectorAll('g.node').forEach(node => {
        const label = node.querySelector('text')?.textContent || '';
        if (/Sequential Scan|Full Table Scan|Table Access Full/i.test(label)) {
            const rect = node.querySelector('rect');
            if (rect) {
                rect.style.stroke = '#2196f3';
                rect.style.strokeWidth = '3px';
                rect.style.strokeDasharray = '6,3';
                rect.style.fill = '#fff';
            }
        }
    });
}

function highlightCostliestNode(svg, explainText, dbEngine) {
    console.log('[DEBUG] highlightCostliestNode called');
    if (!svg || typeof svg.querySelectorAll !== 'function') return;
    const nodes = svg.querySelectorAll('g.node');
    let maxNode = null;
    let maxMetric = -Infinity;
    dbEngine = dbEngine ? dbEngine.toLowerCase() : '';
    if (dbEngine === 'postgresql' || dbEngine === 'oracle') {
    nodes.forEach(node => {
        const label = node.textContent || '';
        const match = label.match(/cost=([0-9.]+)\.\.([0-9.]+)/);
        if (match) {
            const cost = parseFloat(match[2]);
                if (cost > maxMetric) {
                    maxMetric = cost;
                maxNode = node;
            }
        }
    });
    if (!maxNode && explainText) {
        const costRegex = /([A-Za-z_ ]+).*cost=([0-9.]+)\.\.([0-9.]+)/g;
        let maxCostLabel = '';
        let match;
        while ((match = costRegex.exec(explainText)) !== null) {
            const label = match[1].trim();
            const cost = parseFloat(match[3]);
                if (cost > maxMetric) {
                    maxMetric = cost;
                maxCostLabel = label;
            }
        }
            if (maxMetric > 0 && maxCostLabel) {
            nodes.forEach(node => {
                const label = node.textContent || '';
                if (label.toLowerCase().includes(maxCostLabel.toLowerCase())) {
                    maxNode = node;
                }
            });
        }
    }
    } else if (dbEngine === 'sqlserver' || dbEngine === 'sqlite') {
        nodes.forEach(node => {
            const label = node.textContent || '';
            let rows = -1;
            let isTableScan = false;
            const rowMatch = label.match(/rows?=([0-9]+)/i) || label.match(/row\(s\)\s*([0-9]+)/i);
            if (rowMatch) {
                rows = parseInt(rowMatch[1], 10);
            }
            if (/table scan/i.test(label)) {
                isTableScan = true;
            }
            if (/scan table|search table/i.test(label)) {
                isTableScan = true;
            }
            if (isTableScan && rows > maxMetric) {
                maxMetric = rows;
                maxNode = node;
            } else if (!maxNode && rows > maxMetric) {
                maxMetric = rows;
                maxNode = node;
            }
        });
        if (!maxNode) {
            nodes.forEach(node => {
                const label = node.textContent || '';
                if (/table scan|scan table|search table/i.test(label)) {
                    maxNode = node;
                }
            });
        }
    }
    if (maxNode) {
        maxNode.classList.add('costliest');
        console.log('[DEBUG] Costliest node found and highlighted:', maxNode.textContent);
    } else if (nodes.length > 0) {
        nodes[0].classList.add('costliest');
        console.log('[DEBUG] No costliest node found, defaulted to first node.');
    }
}

// Helper function to extract table names from SQL query
function extractTableNames(sql) {
    if (!sql) return [];
    // Remove comments
    sql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove string literals to avoid false matches
    sql = sql.replace(/'[^']*'/g, '');
    // Common table patterns
    const patterns = [
        /(?:FROM|JOIN|UPDATE|INTO)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)/gi,
        /(?:FROM|JOIN|UPDATE|INTO)\s+\[([^\]]+)\]/gi,
        /(?:FROM|JOIN|UPDATE|INTO)\s+"([^"]+)"/gi
    ];
    const tables = new Set();
    // Extract tables using each pattern
    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(sql)) !== null) {
            // Remove schema if present
            const tableName = match[1].split('.').pop().replace(/[\[\]"]/g, '').trim();
            if (tableName && !tableName.includes('(')) { // Exclude subqueries
                tables.add(tableName);
            }
        }
    });
    // Handle WITH clause (CTEs)
    const withMatch = sql.match(/WITH\s+([^(]*)\s+AS/i);
    if (withMatch) {
        const cteName = withMatch[1].trim();
        tables.delete(cteName); // Remove CTE name from tables
    }
    return Array.from(tables);
}

// Function to add a table entry to the DOM
function addTable(
    name = '', ddl = '', rows = '', size = '', hasPrimaryKey = false, primaryKeyColumn = '',
    hasForeignKey = false, foreignKeyColumn = '', foreignKeyTable = ''
) {
    const container = document.getElementById('tables-container');
    if (!container) return;
    const tableDiv = document.createElement('div');
    tableDiv.className = 'table-entry mb-3 position-relative';
    tableDiv.innerHTML = `
        <div class="card">
            <div class="card-body position-relative">
                <button type="button" class="btn-close remove-table-btn position-absolute top-0 end-0 m-2" aria-label="Remove Table"></button>
                <input type="text" class="form-control mb-2" placeholder="Table Name" value="${name}" required>
                <textarea class="form-control mb-2" placeholder="Table DDL" rows="3" required>${ddl}</textarea>
                <input type="number" class="form-control mb-2" placeholder="Number of Rows" value="${rows}">
                <input type="text" class="form-control mb-2" placeholder="Table Size" value="${size}">
                <div class="form-check mb-2">
                    <input type="checkbox" class="form-check-input" id="primaryKeyCheck" ${hasPrimaryKey ? 'checked' : ''}>
                    <label class="form-check-label" for="primaryKeyCheck">Has Primary Key</label>
                </div>
                <input type="text" class="form-control mb-2 d-none" placeholder="Primary Key" value="${primaryKeyColumn}">
                <div class="form-check mb-2">
                    <input type="checkbox" class="form-check-input" id="foreignKeyCheck" ${hasForeignKey ? 'checked' : ''}>
                    <label class="form-check-label" for="foreignKeyCheck">Has Foreign Key</label>
                </div>
                <input type="text" class="form-control mb-2 d-none" placeholder="Foreign Keys" value="${foreignKeyColumn}">
            </div>
        </div>
    `;
    const removeBtn = tableDiv.querySelector('.remove-table-btn');
    removeBtn.addEventListener('click', function() { tableDiv.remove(); });
    // Show/hide primary key input
    const pkCheck = tableDiv.querySelector('#primaryKeyCheck');
    const pkInput = tableDiv.querySelectorAll('input[placeholder="Primary Key"]')[0];
    pkCheck.addEventListener('change', function() {
        pkInput.classList.toggle('d-none', !this.checked);
    });
    // Show/hide foreign key input
    const fkCheck = tableDiv.querySelector('#foreignKeyCheck');
    const fkInput = tableDiv.querySelectorAll('input[placeholder="Foreign Keys"]')[0];
    fkCheck.addEventListener('change', function() {
        fkInput.classList.toggle('d-none', !this.checked);
    });
    container.appendChild(tableDiv);
}

// Function to add an index entry to the DOM
function addIndex(
    name = '', table = '', definition = '', size = ''
) {
    const container = document.getElementById('indexes-container');
    if (!container) return;
    const indexDiv = document.createElement('div');
    indexDiv.className = 'index-entry mb-3 position-relative';
    indexDiv.innerHTML = `
        <div class="card">
            <div class="card-body position-relative">
                <button type="button" class="btn-close remove-index-btn position-absolute top-0 end-0 m-2" aria-label="Remove Index"></button>
                <input type="text" class="form-control mb-2" placeholder="Index Name" value="${name}" required>
                <input type="text" class="form-control mb-2" placeholder="Table Name" value="${table}">
                <textarea class="form-control mb-2" placeholder="Index DDL" rows="3" required>${definition}</textarea>
                <input type="text" class="form-control mb-2" placeholder="Index Size" value="${size}">
            </div>
        </div>
    `;
    const removeBtn = indexDiv.querySelector('.remove-index-btn');
    removeBtn.addEventListener('click', function() { indexDiv.remove(); });
    container.appendChild(indexDiv);
}

// Add top-level stub for showHowToGenerate if not already defined
function showHowToGenerate() {
    alert('showHowToGenerate not yet implemented!');
}

// Add top-level stubs if not already defined
function generateExplainVisualization() {
    console.log('[Visualizer] generateExplainVisualization called');
    
    // Get the selected database engine (fix: use 'db-engine' with hyphen)
    const dbEngineSelect = document.getElementById('db-engine');
    const dbEngine = dbEngineSelect ? dbEngineSelect.value.toLowerCase() : 'postgresql';
    console.log('[Visualizer] Selected DB Engine:', dbEngine);
    
    // Get explain plan text
    const explainInput = document.getElementById('explain_plan_textarea');
    if (!explainInput || !explainInput.value.trim()) {
        if (!window._toastShown) {
            showToast('Please enter an EXPLAIN plan to visualize.', 'warning');
            window._toastShown = true;
            setTimeout(() => { window._toastShown = false; }, 2000);
        }
        return;
    }
    
    const explainText = explainInput.value.trim();
    console.log('[Visualizer] Explain text length:', explainText.length);
    
    // Validate plan format based on selected engine
    let isValidFormat = false;
    let planTree = null;
    
    try {
        if (dbEngine === 'postgresql') {
            if (/^\s*\{/.test(explainText) && /"Plan"/.test(explainText)) {
                planTree = normalizePostgresPlan(JSON.parse(explainText));
                isValidFormat = true;
            } else if (/cost=\d+\.\./i.test(explainText) || /Seq Scan|Index Scan|Hash Join/i.test(explainText)) {
                planTree = parsePostgresTextPlan(explainText);
                isValidFormat = true;
            } else {
                if (!window._toastShown) {
                    showToast('Input does not appear to be a valid PostgreSQL EXPLAIN plan. Please check the format.', 'error');
                    window._toastShown = true;
                    setTimeout(() => { window._toastShown = false; }, 2000);
                }
                return;
            }
        } else if (dbEngine === 'oracle') {
            if (/^\s*\{/.test(explainText) && /"operation"/.test(explainText)) {
                planTree = parseOraclePlan(explainText);
                isValidFormat = true;
            } else if (/\bId\b.*\bOperation\b/i.test(explainText) || /SELECT STATEMENT/i.test(explainText)) {
                planTree = parseOraclePlan(explainText);
                isValidFormat = true;
            } else if (/^\s*\/\*\+/.test(explainText) || /outline data/i.test(explainText)) {
                if (!window._toastShown) {
                    showToast('Outline Data is not a valid EXPLAIN plan. Please provide the actual execution plan.', 'error');
                    window._toastShown = true;
                    setTimeout(() => { window._toastShown = false; }, 2000);
                }
                return;
            } else {
                if (!window._toastShown) {
                    showToast('Input does not appear to be a valid Oracle EXPLAIN plan. Please check the format.', 'error');
                    window._toastShown = true;
                    setTimeout(() => { window._toastShown = false; }, 2000);
                }
                return;
            }
        } else if (dbEngine === 'sqlserver' || dbEngine === 'mssql') {
            if (/^\s*</.test(explainText) && /ShowPlanXML/i.test(explainText)) {
                planTree = parseMSSQLPlan(explainText);
                isValidFormat = true;
            } else {
                if (!window._toastShown) {
                    showToast('Input does not appear to be a valid SQL Server EXPLAIN plan. Please check the format.', 'error');
                    window._toastShown = true;
                    setTimeout(() => { window._toastShown = false; }, 2000);
                }
                return;
            }
        } else {
            if (!window._toastShown) {
                showToast('Unsupported database engine selected.', 'error');
                window._toastShown = true;
                setTimeout(() => { window._toastShown = false; }, 2000);
            }
            return;
        }

        if (!isValidFormat || !planTree) {
            if (!window._toastShown) {
                showToast('Failed to parse the EXPLAIN plan. Please check the format and try again.', 'error');
                window._toastShown = true;
                setTimeout(() => { window._toastShown = false; }, 2000);
            }
            return;
        }

    } catch (err) {
        console.error('[Visualizer] Parse error:', err);
        if (!window._toastShown) {
            showToast('Failed to parse EXPLAIN plan: ' + (err.message || 'Unknown error'), 'error');
            window._toastShown = true;
            setTimeout(() => { window._toastShown = false; }, 2000);
        }
        return;
    }
    
    // Find container and render
    const container = document.getElementById('d3_explain_output') || document.getElementById('visualization_container');
    if (!container) {
        console.log('[Visualizer] No container found for rendering!');
        return;
    }
    
    renderExplainPlan(planTree, container);
    
    // Enable download button
    const downloadBtn = document.getElementById('download-svg-btn');
    if (downloadBtn) downloadBtn.disabled = false;
    
    console.log('[Visualizer] Plan rendered successfully');
}

function beautifySQL() {
    const sqlInput = document.getElementById('sql_query');
    if (sqlInput && sqlInput.value.trim()) {
        let sql = sqlInput.value.trim();
        // Add newlines before major SQL keywords
        sql = sql.replace(/\b(SELECT|FROM|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|JOIN|ON|AND|OR)\b/gi, '\n$1');
        // Add newlines after commas
        sql = sql.replace(/,\s*/g, ',\n    ');
        // Remove multiple newlines
        sql = sql.replace(/\n{2,}/g, '\n');
        // Remove leading/trailing whitespace on each line
        sql = sql.split('\n').map(line => line.trim()).join('\n');
        // Remove excessive spaces
        sql = sql.replace(/\s{2,}/g, ' ');
        sqlInput.value = sql.trim();
        showToast('SQL query beautified!', 'success');
    }
}

// Place these at the very end of the file, after all function definitions
window.generateCSVHelpContent = populateCSVHelpModal;
window.populateCSVHelpModal = populateCSVHelpModal;
window.extractTableNames = extractTableNames;
window.generateExplainVisualization = generateExplainVisualization;
window.beautifySQL = beautifySQL;
window.addTable = addTable;
window.addIndex = addIndex;
window.showHowToGenerate = showHowToGenerate;

// --- PostgreSQL EXPLAIN (FORMAT JSON) Visualizer ---

// Humanize node types for display
function humanizeNodeType(type) {
    const map = {
        'Seq Scan': 'Sequential Scan',
        'Index Scan': 'Index Scan',
        'Bitmap Heap Scan': 'Bitmap Heap Scan',
        'Bitmap Index Scan': 'Bitmap Index Scan',
        'Hash Join': 'Hash Join',
        'Merge Join': 'Merge Join',
        'Nested Loop': 'Nested Loop',
        'Aggregate': 'Aggregate',
        'Sort': 'Sort',
        'Limit': 'Limit',
        'Gather': 'Parallel Gather',
        'Gather Merge': 'Parallel Gather Merge',
        // Add more as needed
    };
    return map[type] || type;
}

// Normalize PostgreSQL JSON plan to visualizer tree
function normalizePostgresPlan(plan, costliest = {cost: -Infinity, node: null}) {
    function walk(node) {
        const cost = node['Total Cost'] || 0;
        if (cost > costliest.cost) {
            costliest.cost = cost;
            costliest.node = node;
        }
        return {
            label: humanizeNodeType(node['Node Type']),
            cost: cost,
            rows: node['Plan Rows'] || 0,
            extra: node['Index Cond'] || node['Join Filter'] || node['Filter'] || '',
            children: (node['Plans'] || []).map(walk),
            _raw: node
        };
    }
    const root = walk(plan);
    function markCostliest(n) {
        n.isCostliest = (n.cost === costliest.cost);
        (n.children || []).forEach(markCostliest);
    }
    markCostliest(root);
    return root;
}

// --- PostgreSQL Text EXPLAIN Plan Parser ---
function parsePostgresTextPlan(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const root = { label: 'Plan', children: [], depth: -1 };
    const stack = [root];
    lines.forEach(line => {
        const match = line.match(/^(\s*)(->)?\s*(.+)$/);
        if (!match) return;
        const indent = match[1].length;
        const content = match[3];
        // Parse label and metrics
        const labelMatch = content.match(/^([^(]+)\s*\(([^)]+)\)/);
        let label = content, cost = 0, rows = 0, extra = '';
        if (labelMatch) {
            label = labelMatch[1].trim();
            const metrics = labelMatch[2];
            const costMatch = metrics.match(/cost=([0-9.]+)\.\.([0-9.]+)/);
            if (costMatch) cost = parseFloat(costMatch[2]);
            const rowsMatch = metrics.match(/rows=([0-9]+)/);
            if (rowsMatch) rows = parseInt(rowsMatch[1]);
            extra = metrics;
        }
        // Find parent by indentation
        while (stack.length > 1 && indent <= stack[stack.length - 1].depth) stack.pop();
        const node = {
            label: humanizeNodeType(label),
            cost,
            rows,
            extra,
            children: [],
            depth: indent
        };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
    });
    // Mark costliest node
    let maxCost = -Infinity;
    function markCostliest(n) {
        if (n.cost > maxCost) maxCost = n.cost;
        (n.children || []).forEach(markCostliest);
    }
    markCostliest(root);
    function setCostliest(n) {
        n.isCostliest = (n.cost === maxCost);
        (n.children || []).forEach(setCostliest);
    }
    setCostliest(root);
    return root.children[0] || root; // skip dummy root
}

// --- MSSQL SHOWPLAN_XML Parser ---
function parseMSSQLPlan(xmlText) {
    // Parse XML string to DOM
    let parser = new DOMParser();
    let xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    // Find the root RelOp
    let rootRelOp = xmlDoc.querySelector('RelOp');
    if (!rootRelOp) throw new Error('No RelOp found in MSSQL plan');
    // Recursively build tree
    function walk(node) {
        let physicalOp = node.getAttribute('PhysicalOp') || '';
        let logicalOp = node.getAttribute('LogicalOp') || '';
        let estRows = node.getAttribute('EstimateRows') || node.getAttribute('EstimatedRows') || '';
        let estIO = node.getAttribute('EstimateIO') || '';
        let estCPU = node.getAttribute('EstimateCPU') || '';
        let nodeLabel = physicalOp || logicalOp || 'Op';
        let extra = '';
        if (estRows) extra += `Rows: ${estRows} `;
        if (estIO) extra += `IO: ${estIO} `;
        if (estCPU) extra += `CPU: ${estCPU}`;
        // Children: Nested RelOp or Action
        let children = [];
        let childNodes = node.querySelectorAll(':scope > RelOp, :scope > Action > RelOp');
        childNodes.forEach(child => {
            children.push(walk(child));
        });
        return {
            label: nodeLabel,
            cost: parseFloat(estIO) || parseFloat(estCPU) || 0,
            rows: parseFloat(estRows) || 0,
            extra: extra.trim(),
            children: children,
            _raw: node
        };
    }
    return walk(rootRelOp);
}

// --- Oracle EXPLAIN Plan Help Modal ---
function showOracleExplainHelp() {
    const helpHtml = `
    <div style="max-width:700px;margin:0 auto;">
      <h3>Oracle EXPLAIN Plan FORMAT Options</h3>
      <table class="table table-bordered table-sm" style="font-size:0.95em;">
        <thead><tr><th>Format Type</th><th>Description</th><th>Use Case</th></tr></thead>
        <tbody>
          <tr><td>BASIC</td><td>Minimal output. Only operation and object name.</td><td>Simple overviews, low verbosity</td></tr>
          <tr><td>TYPICAL (default)</td><td>Adds predicate info, optimizer cost, cardinality, etc.</td><td>Standard human-readable plans</td></tr>
          <tr><td>ALL</td><td>Includes all available plan information.</td><td>Best for diagnostics & audits</td></tr>
          <tr><td>OUTLINE</td><td>Displays the outline data (hints used by optimizer).</td><td>For hint tracing & plan reproducibility</td></tr>
          <tr><td>PROJECTION</td><td>Adds output expressions (columns retrieved in each step).</td><td>For data lineage & transformation</td></tr>
          <tr><td>ADVANCED</td><td>Adds projection + row source statistics, I/O stats, and memory stats.</td><td>Near-complete view, great for tuning</td></tr>
          <tr><td>ALLSTATS LAST</td><td>Adds runtime stats for last execution. Shows real vs estimated rows, buffers, etc.</td><td>Essential for tuning</td></tr>
          <tr><td>ALLSTATS ALL</td><td>Shows stats for all executions (useful for cursors used in loops).</td><td>Aggregated multi-execution tuning</td></tr>
          <tr><td>ALLSTATS LAST IOSTATS</td><td>Adds logical/physical I/O per row source.</td><td>I/O-intensive query analysis</td></tr>
          <tr><td>ALLSTATS LAST MEMSTATS</td><td>Shows memory usage for operations (e.g. hash join/sort spills).</td><td>Memory pressure identification</td></tr>
          <tr><td>ALLSTATS LAST ALIAS</td><td>Adds alias names to table references.</td><td>Makes visual plans more readable</td></tr>
          <tr><td>ALLSTATS LAST OUTLINE</td><td>Combines execution stats + hints used.</td><td>Full execution + reproducibility check</td></tr>
          <tr><td>ALLSTATS LAST PROJECTION</td><td>Adds projected columns + runtime stats.</td><td>Data lineage + row stats together</td></tr>
          <tr><td>+COST +BYTES +CARDINALITY</td><td>Fine-grained options for more control over TYPICAL/ALL formats.</td><td>Customize display granularity</td></tr>
        </tbody>
      </table>
      <h4>Sample Usage</h4>
      <pre style="background:#f8f9fa;padding:0.7em;">SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(FORMAT => 'ALLSTATS LAST IOSTATS MEMSTATS ALIAS'));</pre>
      <ul>
        <li><b>Recommended for visualization:</b> <code>ALLSTATS LAST IOSTATS MEMSTATS ALIAS</code> or <code>ADVANCED</code></li>
        <li>For data lineage: <code>ALLSTATS LAST PROJECTION</code></li>
        <li>For hint tracing: <code>OUTLINE</code></li>
      </ul>
      <p style="font-size:0.95em;">For best results, generate your plan using one of the above formats and paste the output here.</p>
    </div>
    `;
    showModal('Oracle EXPLAIN Plan Help', helpHtml);
}

// Attach context-sensitive help to Oracle selection
const dbEngineSelect = document.getElementById('db-engine');
if (dbEngineSelect) {
    dbEngineSelect.addEventListener('change', function() {
        if (this.value.toLowerCase() === 'oracle') {
            const helpBtn = document.getElementById('oracle-explain-help-btn');
            if (helpBtn) helpBtn.style.display = 'inline-block';
        } else {
            const helpBtn = document.getElementById('oracle-explain-help-btn');
            if (helpBtn) helpBtn.style.display = 'none';
        }
    });
}

// --- Enhanced Oracle Plan Parser ---
function parseOraclePlan(text) {
    // Try JSON format first
    try {
        const jsonData = JSON.parse(text);
        if (jsonData.plan) {
            return parseOracleJSONPlan(jsonData.plan);
        }
    } catch (e) {
        // Not JSON, continue with text parsing
    }
    // Try tabular format
    const lines = text.split('\n');
    let headerIdx = lines.findIndex(l => /\bId\b.*\bOperation\b/i.test(l));
    if (headerIdx !== -1) {
        // Use regex to split columns and filter out empty columns
        const headerLine = lines[headerIdx];
        const headerCols = headerLine.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
        const colMap = {};
        headerCols.forEach((col, idx) => {
            colMap[col.toLowerCase()] = idx;
        });
        // Debug: log header and first 5 data lines
        console.log('[Oracle Parser] Header:', headerLine);
        for (let i = headerIdx + 1; i < Math.min(headerIdx + 6, lines.length); i++) {
            console.log('[Oracle Parser] Data line:', lines[i]);
        }
        let nodes = [];
        for (let i = headerIdx + 1; i < lines.length; i++) {
            let l = lines[i];
            if (/predicate information|outline data/i.test(l)) break;
            if (!/\|/.test(l) || /^-+$/.test(l.replace(/\|/g, ''))) continue; // skip non-table lines
            // Use regex to split columns and filter out empty columns
            const cols = l.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
            // Only parse if required columns exist
            if (colMap['id'] === undefined || colMap['operation'] === undefined) continue;
            // Parse columns
            const idStr = colMap['id'] !== undefined ? cols[colMap['id']].replace(/\D/g, '') : '';
            if (!/^\d+$/.test(idStr)) continue; // Only process rows with a valid numeric Id
            const id = parseInt(idStr);
            const operation = colMap['operation'] !== undefined ? cols[colMap['operation']] : '';
            const name = colMap['name'] !== undefined && cols[colMap['name']] !== undefined ? cols[colMap['name']] : '';
            const rows = colMap['rows'] !== undefined && cols[colMap['rows']] !== undefined && /^\d+$/.test(cols[colMap['rows']]) ? parseInt(cols[colMap['rows']]) : 0;
            let cost = 0;
            if (colMap['cost (%cpu)'] !== undefined && cols[colMap['cost (%cpu)']] !== undefined) {
                const costStr = cols[colMap['cost (%cpu)']];
                const costMatch = costStr && costStr.match(/(\d+)/);
                cost = costMatch ? parseInt(costMatch[1]) : 0;
            }
            let label = (operation ? operation : '') + (name ? ' on ' + name : '');
            // Determine parent by id sequence (id-1 is parent, except for root)
            let parent = null;
            if (id !== null && id > 0) {
                for (let j = nodes.length - 1; j >= 0; j--) {
                    if (nodes[j].id < id) {
                        parent = nodes[j].id;
                        break;
                    }
                }
            }
            nodes.push({ id, parent, operation, name, rows, cost, label, extra: '', children: [], _raw: l });
        }
        // Build tree
        let nodeMap = {};
        nodes.forEach(n => { nodeMap[n.id] = n; });
        nodes.forEach(n => {
            if (n.parent !== null && nodeMap[n.parent]) {
                nodeMap[n.parent].children.push(n);
            }
        });
        // Log all parsed IDs for debugging
        console.log('[Oracle Parser] Parsed node IDs:', nodes.map(n => n.id));
        // Use node with Id = 0 as root, or lowest Id if not found
        let root = nodeMap[0];
        if (!root) {
            const minId = Math.min(...nodes.map(n => n.id));
            root = nodeMap[minId];
            console.log('[Oracle Parser] Using lowest Id as root:', minId);
        }
        if (!root || !root.label) {
            throw new Error('Could not find a valid root node (Id = 0 or lowest Id) in the Oracle plan.');
        }
        function toTree(n) {
            if (!n) return null;
            return {
                label: n.label,
                cost: n.cost,
                rows: n.rows,
                extra: n.extra,
                children: (n.children || []).map(toTree).filter(Boolean),
                _raw: n
            };
        }
        return toTree(root);
    } else {
        // Try indented format
        return parseOracleIndentedPlan(text);
    }
}

// --- Oracle JSON Plan Parser ---
function parseOracleJSONPlan(jsonPlan) {
    function walk(node) {
        const label = node.operation + (node.object_name ? ' on ' + node.object_name : '');
        let extra = '';
        if (node.filter_predicates && node.filter_predicates.length > 0) {
            extra = 'Filter: ' + node.filter_predicates.join(', ');
        }
        return {
            label: label,
            cost: node.cost || 0,
            rows: node.cardinality || 0,
            extra: extra,
            children: node.children ? node.children.map(walk) : [],
            _raw: node
        };
    }
    return walk(jsonPlan);
}

// --- Indented Oracle Plan Text Parser ---
function parseOracleIndentedPlan(text) {
    // Each line: [indent]OPERATION [OBJECT] (Cost=... Card=...)
    const lines = text.split('\n').filter(l => l.trim());
    const nodeRegex = /^(\s*)([A-Z ]+)([A-Z0-9_ ]+)?\s*\(([^)]*)\)?/i;
    function parseProps(str) {
        let cost = null, card = null;
        str.split(/\s+/).forEach(part => {
            if (/^Cost=/i.test(part)) cost = parseInt(part.replace(/[^\d]/g, ''));
            if (/^Card=/i.test(part)) card = parseInt(part.replace(/[^\d]/g, ''));
        });
        return { cost, card };
    }
    let stack = [];
    let root = null;
    lines.forEach(line => {
        const m = nodeRegex.exec(line);
        if (!m) return;
        const indent = m[1].length;
        const op = m[2].trim();
        const obj = m[3] ? m[3].trim() : '';
        const props = m[4] ? parseProps(m[4]) : {};
        const node = {
            label: op + (obj ? ' ' + obj : ''),
            cost: props.cost || 0,
            rows: props.card || 0,
            extra: '',
            children: [],
            _raw: line
        };
        // Find parent by indentation
        while (stack.length && stack[stack.length-1].indent >= indent) stack.pop();
        if (stack.length === 0) {
            root = node;
        } else {
            stack[stack.length-1].node.children.push(node);
        }
        stack.push({indent, node});
    });
    return root;
}

// D3.js visualizer for normalized plan
function renderExplainPlan(plan, container) {
    if (!container) {
        // Show a visible error message on the page
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.fontWeight = 'bold';
        errorDiv.style.margin = '2rem';
        errorDiv.textContent = '[D3 Visualizer Error] No container found for rendering!';
        document.body.prepend(errorDiv);
        console.error('[Visualizer] No container found for rendering!');
                    return;
    }
    container.innerHTML = '';
    // Only render the SVG/chart, do NOT add any legend here
    const svgWrapper = document.createElement('div');
    svgWrapper.style.width = '100%';
    svgWrapper.style.display = 'block';
    svgWrapper.style.margin = '0'; // Remove extra margin at the bottom
    svgWrapper.style.background = '#e3f2fd';
    svgWrapper.style.border = '1px solid #ccc';
    svgWrapper.style.height = '88vh'; // Use even more vertical space
    svgWrapper.style.maxHeight = '88vh'; // Allow flowchart to expand closer to legend
    svgWrapper.style.overflow = 'auto';
    container.appendChild(svgWrapper);
    // Responsive SVG
    const width = svgWrapper.offsetWidth || 1600;
    const height = svgWrapper.offsetHeight || 700;
    const margin = {top: 80, right: 120, bottom: 80, left: 120};
    const svg = d3.select(svgWrapper)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .call(d3.zoom().on('zoom', function (event) {
            g.attr('transform', event.transform);
        }));
    const g = svg.append('g');
    if (!plan) {
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', 28)
            .attr('fill', 'red')
            .text('No plan data to visualize');
        return;
    }
    const root = d3.hierarchy(plan);
    // More vertical and horizontal spacing
    const nodeWidth = 320, nodeHeight = 100, nodeSep = 80, levelSep = 120;
    const treeLayout = d3.tree()
        .nodeSize([nodeWidth + nodeSep, nodeHeight + levelSep]);
    treeLayout(root);
    // Center the graph horizontally
    const minX = d3.min(root.descendants(), d => d.x);
    const maxX = d3.max(root.descendants(), d => d.x);
    const centerX = (minX + maxX) / 2;
    g.attr('transform', `translate(${width / 2 - centerX},${margin.top})`);
    // Color scale for cost
    const maxCost = d3.max(root.descendants(), d => d.data.cost || 0) || 1;
    const colorScale = d3.scaleLinear()
        .domain([0, maxCost])
        .range(['#4caf50', '#e53935']); // green to red
    // Draw links (thinner, lighter)
    g.selectAll('.link')
        .data(root.links())
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y))
        .attr('fill', 'none')
        .attr('stroke', '#bbb')
        .attr('stroke-width', 1.5);
    // Draw nodes
    const node = g.selectAll('.node')
        .data(root.descendants())
        .enter()
        .append('g')
        .attr('class', d => {
            let cls = 'node';
            if (d.data.isCostliest) cls += ' costliest';
            // Highlight sequential/full scans
            if (/seq(\.|uential)? scan|table scan|table access full|full table scan/i.test(d.data.label)) cls += ' seqscan';
            return cls;
        })
        .attr('transform', d => `translate(${d.x},${d.y})`);
    // Node rectangles with shadow
    node.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('x', -nodeWidth / 2)
        .attr('y', -nodeHeight / 2)
        .attr('rx', 18)
        .attr('fill', d => colorScale(d.data.cost || 0))
        .attr('stroke', d => d.data.isCostliest ? '#FFD700' : (/seq(\.|uential)? scan|table scan|table access full|full table scan/i.test(d.data.label) ? '#2196f3' : '#333'))
        .attr('stroke-width', d => d.data.isCostliest ? 5 : (/seq(\.|uential)? scan|table scan|table access full|full table scan/i.test(d.data.label) ? 5 : 2))
        .attr('stroke-dasharray', d => /seq(\.|uential)? scan|table scan|table access full|full table scan/i.test(d.data.label) ? '10,6' : null)
        .attr('filter', d => d.data.isCostliest ? 'url(#glow)' : null)
        .attr('opacity', 0.97)
        .style('filter', 'drop-shadow(0 4px 16px #8882)');
    // Node label background for readability
    node.append('rect')
        .attr('x', -nodeWidth / 2 + 10)
        .attr('y', -nodeHeight / 2 + 10)
        .attr('width', nodeWidth - 20)
        .attr('height', 32)
        .attr('rx', 8)
        .attr('fill', 'rgba(255,255,255,0.85)');
    // Node labels
    node.append('text')
        .attr('y', -nodeHeight / 2 + 32)
        .attr('text-anchor', 'middle')
        .attr('font-size', 22)
        .attr('font-weight', d => d.data.isCostliest ? 'bolder' : 'bold')
        .attr('fill', d => d.data.cost > maxCost * 0.6 ? '#b71c1c' : '#222')
        .text(d => d.data.label);
    // Node metrics background
    node.append('rect')
        .attr('x', -nodeWidth / 2 + 10)
        .attr('y', -nodeHeight / 2 + 48)
        .attr('width', nodeWidth - 20)
        .attr('height', 24)
        .attr('rx', 6)
        .attr('fill', 'rgba(255,255,255,0.8)');
    // Node metrics
    node.append('text')
        .attr('y', -nodeHeight / 2 + 66)
        .attr('text-anchor', 'middle')
        .attr('font-size', 15)
        .attr('fill', '#333')
        .text(d => `Cost: ${d.data.cost}  Rows: ${d.data.rows}`);
    // Node extra info background
    node.append('rect')
        .attr('x', -nodeWidth / 2 + 10)
        .attr('y', -nodeHeight / 2 + 74)
        .attr('width', nodeWidth - 20)
        .attr('height', 18)
        .attr('rx', 4)
        .attr('fill', 'rgba(255,255,255,0.7)');
    node.append('text')
        .attr('y', -nodeHeight / 2 + 86)
        .attr('text-anchor', 'middle')
        .attr('font-size', 13)
        .attr('fill', '#555')
        .text(d => d.data.extra || '');
    // Add SVG filter for glow
    svg.append('defs').append('filter')
        .attr('id', 'glow')
        .html('<feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#FFD700"/>' );
    console.log('[Visualizer] SVG appended to container');
    // At the end of successful rendering:
    const downloadBtn = document.getElementById('download-svg-btn');
    if (downloadBtn) downloadBtn.disabled = false;
}

// --- Context-aware Visualizer ---
function generateExplainVisualization() {
    console.log('[Visualizer] generateExplainVisualization called');
    
    // Get the selected database engine (fix: use 'db-engine' with hyphen)
    const dbEngineSelect = document.getElementById('db-engine');
    const dbEngine = dbEngineSelect ? dbEngineSelect.value.toLowerCase() : 'postgresql';
    console.log('[Visualizer] Selected DB Engine:', dbEngine);
    
    // Get explain plan text
    const explainInput = document.getElementById('explain_plan_textarea');
    if (!explainInput || !explainInput.value.trim()) {
        if (!window._toastShown) {
            showToast('Please enter an EXPLAIN plan to visualize.', 'warning');
            window._toastShown = true;
            setTimeout(() => { window._toastShown = false; }, 2000);
        }
                    return;
                }

    const explainText = explainInput.value.trim();
    console.log('[Visualizer] Explain text length:', explainText.length);
    
    // Validate plan format based on selected engine
    let isValidFormat = false;
    let planTree = null;
    
    try {
        if (dbEngine === 'postgresql') {
            if (/^\s*\{/.test(explainText) && /"Plan"/.test(explainText)) {
                planTree = normalizePostgresPlan(JSON.parse(explainText));
                isValidFormat = true;
            } else if (/cost=\d+\.\./i.test(explainText) || /Seq Scan|Index Scan|Hash Join/i.test(explainText)) {
                planTree = parsePostgresTextPlan(explainText);
                isValidFormat = true;
            } else {
                if (!window._toastShown) {
                    showToast('Input does not appear to be a valid PostgreSQL EXPLAIN plan. Please check the format.', 'error');
                    window._toastShown = true;
                    setTimeout(() => { window._toastShown = false; }, 2000);
                }
                return;
            }
        } else if (dbEngine === 'oracle') {
            if (/^\s*\{/.test(explainText) && /"operation"/.test(explainText)) {
                planTree = parseOraclePlan(explainText);
                isValidFormat = true;
            } else if (/\bId\b.*\bOperation\b/i.test(explainText) || /SELECT STATEMENT/i.test(explainText)) {
                planTree = parseOraclePlan(explainText);
                isValidFormat = true;
            } else if (/^\s*\/\*\+/.test(explainText) || /outline data/i.test(explainText)) {
                if (!window._toastShown) {
                    showToast('Outline Data is not a valid EXPLAIN plan. Please provide the actual execution plan.', 'error');
                    window._toastShown = true;
                    setTimeout(() => { window._toastShown = false; }, 2000);
                }
                return;
            } else {
                if (!window._toastShown) {
                    showToast('Input does not appear to be a valid Oracle EXPLAIN plan. Please check the format.', 'error');
                    window._toastShown = true;
                    setTimeout(() => { window._toastShown = false; }, 2000);
                }
                return;
            }
        } else if (dbEngine === 'sqlserver' || dbEngine === 'mssql') {
            if (/^\s*</.test(explainText) && /ShowPlanXML/i.test(explainText)) {
                planTree = parseMSSQLPlan(explainText);
                isValidFormat = true;
            } else {
                if (!window._toastShown) {
                    showToast('Input does not appear to be a valid SQL Server EXPLAIN plan. Please check the format.', 'error');
                    window._toastShown = true;
                    setTimeout(() => { window._toastShown = false; }, 2000);
                }
                return;
            }
        } else {
            if (!window._toastShown) {
                showToast('Unsupported database engine selected.', 'error');
                window._toastShown = true;
                setTimeout(() => { window._toastShown = false; }, 2000);
            }
                    return;
                }

        if (!isValidFormat || !planTree) {
            if (!window._toastShown) {
                showToast('Failed to parse the EXPLAIN plan. Please check the format and try again.', 'error');
                window._toastShown = true;
                setTimeout(() => { window._toastShown = false; }, 2000);
            }
                    return;
                }

    } catch (err) {
        console.error('[Visualizer] Parse error:', err);
        if (!window._toastShown) {
            showToast('Failed to parse EXPLAIN plan: ' + (err.message || 'Unknown error'), 'error');
            window._toastShown = true;
            setTimeout(() => { window._toastShown = false; }, 2000);
        }
                    return;
                }

    // Find container and render
    const container = document.getElementById('d3_explain_output') || document.getElementById('visualization_container');
    if (!container) {
        console.log('[Visualizer] No container found for rendering!');
                    return;
                }

    renderExplainPlan(planTree, container);
    
    // Enable download button
    const downloadBtn = document.getElementById('download-svg-btn');
    if (downloadBtn) downloadBtn.disabled = false;
    
    console.log('[Visualizer] Plan rendered successfully');
}

window.renderExplainPlan = renderExplainPlan;

document.addEventListener('DOMContentLoaded', function() {
    var d3Container = document.getElementById('d3_explain_output');
    if (d3Container) {
        // Remove D3 test message
        d3Container.innerHTML = '';
    }
    var vizContainer = document.getElementById('visualization_container');
    if (vizContainer) {
        // Remove D3 test message
        vizContainer.innerHTML = '';
    }

    // Ensure event binding happens after DOM is ready
    var genVizBtn = document.getElementById('generate-viz-btn');
    if (genVizBtn) {
        genVizBtn.addEventListener('click', function(e) {
            e.preventDefault();
            generateExplainVisualization();
        });
    }
});

// Fix AJAX/fetch for analyze action
const analyzeBtn = document.getElementById('analyze-btn');
if (analyzeBtn) {
    analyzeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const sql = document.getElementById('sql_query')?.value || '';
        const explain = document.getElementById('explain_plan_textarea')?.value || '';
        const dbEngine = document.getElementById('db-engine')?.value || '';
        // Gather tables and indexes as needed (not shown here)
        const data = {
            sql_query: sql,
            explain_plan: explain,
            db_engine: dbEngine
            // Add tables, indexes, etc. if needed
        };
        // Get CSRF token from hidden input or cookie
        let csrf_token = '';
        const csrfInput = document.querySelector('input[name="csrf_token"]');
        if (csrfInput) {
            csrf_token = csrfInput.value;
        } else {
            // Try to get from cookie
            const match = document.cookie.match(/csrf_token=([^;]+)/);
            if (match) csrf_token = match[1];
        }
        fetch('/analyze', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                'X-CSRFToken': csrf_token
            },
            body: JSON.stringify(data)
        })
        .then(async res => {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const response = await res.json();
                if (response.redirect) {
                    window.location.href = response.redirect;
                } else if (response.error) {
                    showToast('Analyze failed: ' + response.error, 'error');
                }
            } else {
                // Not JSON, show generic error
                const text = await res.text();
                showToast('Analyze failed: Unexpected response from server.', 'error');
                // Optionally log the HTML/text for debugging
                console.error('Analyze response (not JSON):', text);
            }
        })
        .catch(err => {
            showToast('Analyze failed: ' + (err.message || err), 'error');
        });
    });
}

// --- Add Oracle EXPLAIN Plan Help to Main App Help ---
function appendOracleExplainHelpToAppHelp() {
    const appHelpModal = document.getElementById('app-help-modal-content');
    if (!appHelpModal) return;
    // Avoid duplicate insertion
    if (document.getElementById('oracle-explain-help-section')) return;
    const section = document.createElement('section');
    section.id = 'oracle-explain-help-section';
    section.innerHTML = `
      <hr/>
      <h3>Oracle EXPLAIN Plan FORMAT Options</h3>
      <table class="table table-bordered table-sm" style="font-size:0.95em;">
        <thead><tr><th>Format Type</th><th>Description</th><th>Use Case</th></tr></thead>
        <tbody>
          <tr><td>BASIC</td><td>Minimal output. Only operation and object name.</td><td>Simple overviews, low verbosity</td></tr>
          <tr><td>TYPICAL (default)</td><td>Adds predicate info, optimizer cost, cardinality, etc.</td><td>Standard human-readable plans</td></tr>
          <tr><td>ALL</td><td>Includes all available plan information.</td><td>Best for diagnostics & audits</td></tr>
          <tr><td>OUTLINE</td><td>Displays the outline data (hints used by optimizer).</td><td>For hint tracing & plan reproducibility</td></tr>
          <tr><td>PROJECTION</td><td>Adds output expressions (columns retrieved in each step).</td><td>For data lineage & transformation</td></tr>
          <tr><td>ADVANCED</td><td>Adds projection + row source statistics, I/O stats, and memory stats.</td><td>Near-complete view, great for tuning</td></tr>
          <tr><td>ALLSTATS LAST</td><td>Adds runtime stats for last execution. Shows real vs estimated rows, buffers, etc.</td><td>Essential for tuning</td></tr>
          <tr><td>ALLSTATS ALL</td><td>Shows stats for all executions (useful for cursors used in loops).</td><td>Aggregated multi-execution tuning</td></tr>
          <tr><td>ALLSTATS LAST IOSTATS</td><td>Adds logical/physical I/O per row source.</td><td>I/O-intensive query analysis</td></tr>
          <tr><td>ALLSTATS LAST MEMSTATS</td><td>Shows memory usage for operations (e.g. hash join/sort spills).</td><td>Memory pressure identification</td></tr>
          <tr><td>ALLSTATS LAST ALIAS</td><td>Adds alias names to table references.</td><td>Makes visual plans more readable</td></tr>
          <tr><td>ALLSTATS LAST OUTLINE</td><td>Combines execution stats + hints used.</td><td>Full execution + reproducibility check</td></tr>
          <tr><td>ALLSTATS LAST PROJECTION</td><td>Adds projected columns + runtime stats.</td><td>Data lineage + row stats together</td></tr>
          <tr><td>+COST +BYTES +CARDINALITY</td><td>Fine-grained options for more control over TYPICAL/ALL formats.</td><td>Customize display granularity</td></tr>
        </tbody>
      </table>
      <h4>Sample Usage</h4>
      <pre style="background:#f8f9fa;padding:0.7em;">SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(FORMAT => 'ALLSTATS LAST IOSTATS MEMSTATS ALIAS'));</pre>
      <ul>
        <li><b>Recommended for visualization:</b> <code>ALLSTATS LAST IOSTATS MEMSTATS ALIAS</code> or <code>ADVANCED</code></li>
        <li>For data lineage: <code>ALLSTATS LAST PROJECTION</code></li>
        <li>For hint tracing: <code>OUTLINE</code></li>
      </ul>
      <p style="font-size:0.95em;">For best results, generate your plan using one of the above formats and paste the output here.</p>
    `;
    appHelpModal.appendChild(section);
}
// Call this on page load or when help modal is shown
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(appendOracleExplainHelpToAppHelp, 0);
} else {
    document.addEventListener('DOMContentLoaded', appendOracleExplainHelpToAppHelp);
}

document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    // Fix Clear All Inputs button to only clear fields, not submit form
    const clearBtn = document.getElementById('clear-inputs-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Clear all relevant fields
            const sqlInput = document.getElementById('sql_query');
            if (sqlInput) sqlInput.value = '';
            const explainInput = document.getElementById('explain_plan_textarea');
            if (explainInput) explainInput.value = '';
    const tableContainer = document.getElementById('tables-container');
            if (tableContainer) tableContainer.innerHTML = '';
    const indexContainer = document.getElementById('indexes-container');
            if (indexContainer) indexContainer.innerHTML = '';
            // Optionally clear visualization
            const vizContainer = document.getElementById('visualization_container');
            if (vizContainer) vizContainer.innerHTML = '';
            // Disable download button
            const downloadBtn = document.getElementById('download-svg-btn');
            if (downloadBtn) downloadBtn.disabled = true;
        });
    }
    // ... existing code ...
});

// Patch: Robust fetch error handling for JSON responses
function safeFetchJson(url, options) {
    return fetch(url, options).then(async response => {
        const contentType = response.headers.get('content-type');
        if (!response.ok) {
            // Try to extract error message from JSON, else fallback to text
            if (contentType && contentType.includes('application/json')) {
                const err = await response.json();
                throw new Error(err.error || 'Unknown error');
            } else {
                const text = await response.text();
                throw new Error(text.replace(/<[^>]+>/g, '').slice(0, 200)); // Strip HTML tags
            }
        }
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        } else {
            throw new Error('Expected JSON response but got: ' + contentType);
        }
    });
}

// Patch: Sanitize any HTML inserted into the DOM to prevent '&' errors
function setSafeInnerHTML(element, html) {
    // Basic sanitizer: only allow <b>, <i>, <u>, <br>, <span>, <div>, <strong>, <em>
    const allowed = /<(\/?(b|i|u|br|span|div|strong|em)[^>]*)>/gi;
    element.innerHTML = html.replace(/<[^>]+>/g, tag => tag.match(allowed) ? tag : '');
}

// AI Insights Integration
function loadAIPrompts() {
    const container = document.getElementById('ai-prompts-container');
    if (!container) return;
    
    fetch('/ai_prompts')
        .then(response => response.json())
        .then(data => {
            if (data.prompts) {
                renderAIPrompts(data.prompts);
            } else {
                showAIError('Failed to load AI prompts');
            }
        })
        .catch(error => {
            console.error('Error loading AI prompts:', error);
            showAIError('AI service not available');
        });
}

function renderAIPrompts(prompts) {
    const container = document.getElementById('ai-prompts-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    prompts.forEach(prompt => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-3';
        
        col.innerHTML = `
            <div class="card h-100 ai-prompt-card" style="border: 1px solid var(--border-color);">
                <div class="card-body d-flex flex-column">
                    <h6 class="card-title">
                        <i class="fas fa-lightbulb text-warning me-2"></i>
                        ${prompt.title}
                    </h6>
                    <p class="card-text text-muted small flex-grow-1">
                        ${prompt.description}
                    </p>
                    <button class="btn btn-outline-primary btn-sm mt-auto" 
                            onclick="getAIInsight('${prompt.type}')"
                            data-prompt-type="${prompt.type}">
                        <i class="fas fa-robot me-1"></i>
                        Get Insight
                    </button>
                </div>
        </div>
    `;
        
        container.appendChild(col);
    });
}

function getAIInsight(promptType) {
    const button = event.target;
    const originalText = button.innerHTML;
    
    // Show loading state
    button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Generating...';
    button.disabled = true;
    
    // Get share_id from URL
    const shareId = window.location.pathname.split('/').pop();
    
    fetch('/ai_insight', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        },
        body: JSON.stringify({
            prompt_type: promptType,
            share_id: shareId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Redirect to AI insight page
            window.location.href = `/ai_insight/${shareId}/${promptType}`;
        } else {
            showAIError(data.error || 'Failed to generate AI insight');
            // Reset button
            button.innerHTML = originalText;
            button.disabled = false;
        }
    })
    .catch(error => {
        console.error('Error getting AI insight:', error);
        showAIError('Failed to connect to AI service');
        // Reset button
        button.innerHTML = originalText;
        button.disabled = false;
    });
}

function showAIError(message) {
    const container = document.getElementById('ai-prompts-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="col-12">
            <div class="alert alert-warning" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>AI Service Unavailable:</strong> ${message}
                <button class="btn btn-sm btn-outline-warning ms-2" onclick="loadAIPrompts()">
                    <i class="fas fa-redo me-1"></i>Retry
                </button>
            </div>
        </div>
    `;
}

// Initialize AI insights when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load AI prompts if we're on a result page
    if (document.getElementById('ai-prompts-container')) {
        loadAIPrompts();
    }
});
