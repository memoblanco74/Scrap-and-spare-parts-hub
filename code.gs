var BACKUP_FOLDER_ID="1s-bB_CfYAUSMoh462P6QjPeOkDrTotEv";
const SUPABASE_URL = "https://auurmvfaqkxaxowxoqkl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1dXJtdmZhcWt4YXhvd3hvcWtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzY2OTgyNCwiZXhwIjoyMDkzMjQ1ODI0fQ.q7QhImOJu--YdHZo4KIi4Cm2PVoHriJBiInLbGMuS9c";

// دالة أساسية للاتصال بقاعدة البيانات

function supabaseRequest(endpoint, method = "GET", payload = null) {
  var url = SUPABASE_URL + "/rest/v1/" + endpoint;
  var headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=representation" // لإرجاع البيانات بعد التعديل أو الإضافة
  };
  
  var options = {
    method: method,
    headers: headers,
    muteHttpExceptions: true
  };
  
  if (payload) {
    options.payload = JSON.stringify(payload);
  }
  
  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();
  
  if (responseCode >= 200 && responseCode < 300) {
    return responseText ? JSON.parse(responseText) : null;
  } else {
    throw new Error("Supabase Error: " + responseText);
  }
}

function doGet(e){
  return HtmlService.createTemplateFromFile('index').evaluate().setTitle('Scrap & Spare Parts Hub').setFaviconUrl('https://i.ibb.co/spry7pZF/laptop-screen.png').addMetaTag('viewport','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getData(tableName) {
  // تحويل اسم الشيت القديم لاسم الجدول في Supabase
  var tableMap = {
    "Laptops": "laptops",
    "UsageHistory": "usagehistory",
    "SpareParts": "spareparts",
    "Logs": "logs",
    "Groups": "groups",
    "Assets": "assets",
    "DeductHistory": "deducthistory",
    "Downgrade": "downgrade",
    "Data": "data",
    "Users": "users"
  };
  
  var tb = tableMap[tableName] || tableName.toLowerCase();
  
  var allData = [];
  var limit = 1000;
  var offset = 0;
  var fetchMore = true;
  
  // حلقة تكرارية لسحب البيانات على دفعات لتخطي حاجز الـ 1000 سطر
  while (fetchMore) {
    var urlParams = "?select=*&limit=" + limit + "&offset=" + offset;
    var data = supabaseRequest(tb + urlParams);
    
    if (data && data.length > 0) {
      allData = allData.concat(data); // دمج البيانات الجديدة مع القديمة
      offset += limit; // زيادة المؤشر للدفعة التالية
      
      // إذا كانت البيانات العائدة أقل من الـ limit، فهذا يعني أنه لا توجد بيانات أخرى
      if (data.length < limit) {
        fetchMore = false;
      }
    } else {
      fetchMore = false; // لا توجد بيانات
    }
  }
  
  return allData;
}

function getUsersData() {
  var usersList = supabaseRequest("users?select=*&limit=1000");
  var usersObj = {};
  if (usersList && usersList.length > 0) {
    usersList.forEach(function(u) {
      usersObj[u.username] = {
        email: u.username,
        password: u.password_encoded,
        permissions: (typeof u.permissions_json === 'string') ? JSON.parse(u.permissions_json || "{}") : u.permissions_json,
        comment: u.comment
      };
    });
  }
  return usersObj;
}

function setupWeeklyTrigger(){ScriptApp.newTrigger("autoBackupDB").timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(23).create()}
function setupMonthlyArchiveTrigger(){ScriptApp.newTrigger("archiveOldLogs").timeBased().everyDays(30).atHour(4).create()}

function archiveOldLogs() {
  var cutOff = new Date();
  cutOff.setDate(cutOff.getDate() - 365); // سنة كاملة
  var logs = getData("Logs");
  var idsToDelete = [];
  logs.forEach(function(r) {
    try {
      var dStr = String(r.timestamp).split(" ")[0].split("-");
      var d = new Date(dStr[0], dStr[1] - 1, dStr[2]);
      if (d < cutOff && r.id) idsToDelete.push(r.id);
    } catch(e) {}
  });
  
  if(idsToDelete.length > 0) {
     supabaseRequest("logs?id=in.(" + idsToDelete.join(",") + ")", "DELETE");
     return "Archived (Deleted) " + idsToDelete.length + " old logs.";
  }
  return "No old logs found.";
}

function autoBackupDB() {
  // أخذ نسخة احتياطية كملف JSON لجميع الجداول وحفظها في جوجل درايف
  var date = Utilities.formatDate(new Date(), "Africa/Cairo", "yyyy-MM-dd_HH-mm");
  var name = "Backup_ScrapHub_Supabase_" + date + ".json";
  var fullData = {
    laptops: getData("Laptops"),
    spareparts: getData("SpareParts"),
    usagehistory: getData("UsageHistory"),
    deducthistory: getData("DeductHistory"),
    downgrade: getData("Downgrade"),
    users: getUsersData()
  };
  var blob = Utilities.newBlob(JSON.stringify(fullData, null, 2), "application/json", name);
  DriveApp.getFolderById(BACKUP_FOLDER_ID).createFile(blob);
}
