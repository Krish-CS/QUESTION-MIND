package com.krishacademia.questionmind

import android.content.Context
import android.util.Log
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import org.json.JSONObject
import org.json.JSONArray

/**
 * PythonBridge.kt
 * 
 * Manages communication between React Native and native Python runtime.
 * Provides methods for:
 * - AI question generation
 * - Excel export
 * - Document parsing (CDAP, Syllabus)
 * - Local SQLite operations
 */
class PythonBridge(private val context: Context) {
    private var pythonReady = false
    private val TAG = "PythonBridge"

    init {
        initializePython()
    }

    /**
     * Initialize the Python runtime once
     */
    private fun initializePython() {
        if (!Python.isStarted()) {
            try {
                Log.d(TAG, "Starting Python runtime with Chaquopy...")
                Python.start(AndroidPlatform(context))
                pythonReady = true
                Log.d(TAG, "Python runtime initialized successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize Python: ${e.message}", e)
                pythonReady = false
            }
        } else {
            pythonReady = true
            Log.d(TAG, "Python runtime already started")
        }
    }

    /**
     * Generate questions via native Python AI service
     * 
     * @param subjectId Subject UUID
     * @param syllabusCoverage List of units/topics
     * @param partConfigs Question part configurations
     * @param callback Returns JSON with generated questions or error
     */
    fun generateQuestions(
        subjectId: String,
        syllabusCoverage: JSONArray,
        partConfigs: JSONArray,
        callback: (String) -> Unit
    ) {
        Thread {
            try {
                ensurePythonReady()
                
                val py = Python.getInstance()
                val pyObject = py.getModule("mobile_service")
                
                // Convert JSON to Python objects
                val coverage = parseJSONArray(syllabusCoverage)
                val configs = parseJSONArray(partConfigs)
                
                // Call Python function
                val result = pyObject.callAttr(
                    "generate_questions",
                    subjectId,
                    coverage,
                    configs
                )
                
                // Convert result back to JSON
                val jsonResult = JSONObject(convertPythonToJson(result))
                callback(jsonResult.toString())
                
            } catch (e: Exception) {
                Log.e(TAG, "Error in generateQuestions: ${e.message}", e)
                val error = JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Unknown error")
                }
                callback(error.toString())
            }
        }.start()
    }

    /**
     * Export questions to Excel file
     * 
     * @param questions List of question objects
     * @param fileName Output file name (without extension)
     * @param callback Returns path to generated Excel file or error
     */
    fun exportToExcel(
        questions: JSONArray,
        fileName: String,
        callback: (String) -> Unit
    ) {
        Thread {
            try {
                ensurePythonReady()
                
                val py = Python.getInstance()
                val pyObject = py.getModule("mobile_service")
                
                // Get app cache directory for file storage
                val cacheDir = context.cacheDir.absolutePath
                val outputPath = "$cacheDir/$fileName.xlsx"
                
                // Convert JSON to Python list
                val questionsList = parseJSONArray(questions)
                
                // Call Python function
                val result = pyObject.callAttr(
                    "export_questions_excel",
                    questionsList,
                    outputPath
                )
                
                val jsonResult = JSONObject(convertPythonToJson(result))
                callback(jsonResult.toString())
                
            } catch (e: Exception) {
                Log.e(TAG, "Error in exportToExcel: ${e.message}", e)
                val error = JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Export failed")
                }
                callback(error.toString())
            }
        }.start()
    }

    /**
     * Parse CDAP document
     * 
     * @param filePath Path to CDAP file (XML or PDF)
     * @param callback Returns parsed structure or error
     */
    fun parseCdapDocument(
        filePath: String,
        callback: (String) -> Unit
    ) {
        Thread {
            try {
                ensurePythonReady()
                
                val py = Python.getInstance()
                val pyObject = py.getModule("mobile_service")
                
                val result = pyObject.callAttr("parse_cdap_file", filePath)
                val jsonResult = JSONObject(convertPythonToJson(result))
                callback(jsonResult.toString())
                
            } catch (e: Exception) {
                Log.e(TAG, "Error in parseCdapDocument: ${e.message}", e)
                val error = JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Parse failed")
                }
                callback(error.toString())
            }
        }.start()
    }

    /**
     * Parse syllabus document
     * 
     * @param filePath Path to syllabus file (Excel or PDF)
     * @param callback Returns parsed units and topics or error
     */
    fun parseSyllabusDocument(
        filePath: String,
        callback: (String) -> Unit
    ) {
        Thread {
            try {
                ensurePythonReady()
                
                val py = Python.getInstance()
                val pyObject = py.getModule("mobile_service")
                
                val result = pyObject.callAttr("parse_syllabus_file", filePath)
                val jsonResult = JSONObject(convertPythonToJson(result))
                callback(jsonResult.toString())
                
            } catch (e: Exception) {
                Log.e(TAG, "Error in parseSyllabusDocument: ${e.message}", e)
                val error = JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Parse failed")
                }
                callback(error.toString())
            }
        }.start()
    }

    /**
     * Execute SQLite query
     * 
     * @param query SQL query
     * @param params Query parameters
     * @param callback Returns result set or error
     */
    fun executeSqliteQuery(
        query: String,
        params: JSONArray,
        callback: (String) -> Unit
    ) {
        Thread {
            try {
                ensurePythonReady()
                
                val py = Python.getInstance()
                val pyObject = py.getModule("mobile_service")
                
                val paramsList = parseJSONArray(params)
                val result = pyObject.callAttr("execute_sqlite_query", query, paramsList)
                val jsonResult = JSONObject(convertPythonToJson(result))
                callback(jsonResult.toString())
                
            } catch (e: Exception) {
                Log.e(TAG, "Error in executeSqliteQuery: ${e.message}", e)
                val error = JSONObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Query failed")
                }
                callback(error.toString())
            }
        }.start()
    }

    // ==================== Helper Methods ====================

    private fun ensurePythonReady() {
        if (!pythonReady) {
            throw RuntimeException("Python runtime not initialized")
        }
    }

    private fun parseJSONArray(arr: JSONArray): List<Any> {
        val list = mutableListOf<Any>()
        for (i in 0 until arr.length()) {
            when (val value = arr.get(i)) {
                is JSONObject -> list.add(parseJSONObject(value))
                is JSONArray -> list.add(parseJSONArray(value))
                else -> list.add(value)
            }
        }
        return list
    }

    private fun parseJSONObject(obj: JSONObject): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        val keys = obj.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            when (val value = obj.get(key)) {
                is JSONObject -> map[key] = parseJSONObject(value)
                is JSONArray -> map[key] = parseJSONArray(value)
                else -> map[key] = value
            }
        }
        return map
    }

    private fun convertPythonToJson(obj: Any?): Map<String, Any?> {
        return when (obj) {
            null -> mapOf("success" to false, "data" to null)
            is Map<*, *> -> obj as Map<String, Any?>
            else -> mapOf("success" to true, "data" to obj)
        }
    }

    companion object {
        private var instance: PythonBridge? = null

        fun getInstance(context: Context): PythonBridge {
            if (instance == null) {
                instance = PythonBridge(context.applicationContext)
            }
            return instance!!
        }
    }
}
