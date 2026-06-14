package com.krishacademia.questionmind;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

@CapacitorPlugin(name = "PythonBridge")
public class PythonBridgePlugin extends Plugin {

    private PythonBridge pythonBridge;

    @Override
    public void load() {
        super.load();
        pythonBridge = PythonBridge.getInstance(getContext());
    }

    @PluginMethod
    public void generateQuestions(PluginCall call) {
        String subjectId = call.getString("subjectId");
        String syllabusCoverageStr = call.getString("syllabusCoverage");
        String partConfigsStr = call.getString("partConfigs");

        try {
            JSONArray syllabusCoverage = new JSONArray(syllabusCoverageStr);
            JSONArray partConfigs = new JSONArray(partConfigsStr);

            pythonBridge.generateQuestions(subjectId, syllabusCoverage, partConfigs, resultJson -> {
                JSObject ret = new JSObject();
                ret.put("value", resultJson);
                call.resolve(ret);
            });
        } catch (JSONException e) {
            call.reject("Invalid JSON array provided", e);
        }
    }

    @PluginMethod
    public void exportToExcel(PluginCall call) {
        String questionsStr = call.getString("questions");
        String fileName = call.getString("fileName");

        try {
            JSONArray questions = new JSONArray(questionsStr);
            pythonBridge.exportToExcel(questions, fileName, resultJson -> {
                JSObject ret = new JSObject();
                ret.put("value", resultJson);
                call.resolve(ret);
            });
        } catch (JSONException e) {
            call.reject("Invalid JSON array provided", e);
        }
    }

    @PluginMethod
    public void parseCdapDocument(PluginCall call) {
        String filePath = call.getString("filePath");

        pythonBridge.parseCdapDocument(filePath, resultJson -> {
            JSObject ret = new JSObject();
            ret.put("value", resultJson);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void parseSyllabusDocument(PluginCall call) {
        String filePath = call.getString("filePath");

        pythonBridge.parseSyllabusDocument(filePath, resultJson -> {
            JSObject ret = new JSObject();
            ret.put("value", resultJson);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void executeSqliteQuery(PluginCall call) {
        String query = call.getString("query");
        String paramsStr = call.getString("params");

        try {
            JSONArray params = new JSONArray(paramsStr);
            pythonBridge.executeSqliteQuery(query, params, resultJson -> {
                JSObject ret = new JSObject();
                ret.put("value", resultJson);
                call.resolve(ret);
            });
        } catch (JSONException e) {
            call.reject("Invalid JSON array provided", e);
        }
    }

    @PluginMethod
    public void dispatchApiRequest(PluginCall call) {
        String method = call.getString("method");
        String path = call.getString("path");
        JSObject bodyObj = call.getObject("body", null);

        try {
            org.json.JSONObject body = bodyObj != null ? new org.json.JSONObject(bodyObj.toString()) : null;
            pythonBridge.dispatchApiRequest(method, path, body, resultJson -> {
                JSObject ret = new JSObject();
                ret.put("value", resultJson);
                call.resolve(ret);
            });
        } catch (JSONException e) {
            call.reject("Invalid JSON body provided", e);
        }
    }
}
