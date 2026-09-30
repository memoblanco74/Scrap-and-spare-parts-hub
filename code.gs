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
  // لو الطلب فيه callback و payload، يبقى ده استدعاء API عن طريق JSONP (من GitHub Pages مثلاً)
  // بنستخدم أسلوب JSONP لأن Google Apps Script Web Apps مش بتدعم CORS خالص للـ POST/fetch،
  // وتحميل <script> مش خاضع لسياسة CORS من الأساس
  if(e && e.parameter && e.parameter.callback){
    var cb = e.parameter.callback;
    var result;
    try{
      var params = JSON.parse(e.parameter.payload || "{}");
      result = execSafe(params);
    }catch(err){
      result = {status:"error", message: err.toString()};
    }
    var body = cb + "(" + JSON.stringify(result) + ");";
    return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return HtmlService.createTemplateFromFile('index').evaluate().setTitle('Scrap & Spare Parts Hub').setFaviconUrl('https://i.ibb.co/spry7pZF/laptop-screen.png').addMetaTag('viewport','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
// نقطة الدخول القديمة (بتفضل موجودة، بتفيد في حالة same-origin أو استدعاء server-to-server)
function doPost(e){
  try{
    var params = JSON.parse(e.postData.contents);
    var result = execSafe(params);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({status:"error",message:err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
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
function getDashboardStats() {
  var laptops = getData("Laptops");
  var hdd = 0;
  var ssd = 0;
  if(laptops && laptops.length > 0) {
    laptops.forEach(function(l) {
    if(l.hdd === true || String(l.hdd).toUpperCase() === 'TRUE') hdd++;
    if(l.ssd === true || String(l.ssd).toUpperCase() === 'TRUE') ssd++;
    });
  }
  return {hdd: hdd, ssd: ssd};
}
function getFilteredUsageReport(params) {
  var usageData = getData("UsageHistory");
  var partsData = getData("SpareParts");
  var partsMap = {};
  
  partsData.forEach(function(p) {
    if (p.id) partsMap[p.id] = p;
  });

  var types = params.types || [];
  var sites = params.sites || [];
  
  var start = params.startDate ? new Date(params.startDate) : null;
  if (start) start.setHours(0, 0, 0, 0);
  
  var end = params.endDate ? new Date(params.endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);

  var filtered = [];
  usageData.forEach(function(u) {
    if (types.length > 0 && types.indexOf(u.type) === -1) return;
    
    var currentPartId = u.part_id || u.partId; 
    var part = partsMap[currentPartId] || {};
    var pSite = part.site || "";
    
    if (sites.length > 0 && sites.indexOf(pSite) === -1) return;

    var uDate = null;
    if (u.date) {
      if (u.date instanceof Date) {
        uDate = u.date;
      } else {
        var str = String(u.date).trim();
        uDate = new Date(str.replace(" ", "T"));
      }
    }

    // التأكد من أن التاريخ صالح قبل المقارنة
    if (start && (!uDate || isNaN(uDate.getTime()) || uDate < start)) return;
    if (end && (!uDate || isNaN(uDate.getTime()) || uDate > end)) return;

    filtered.push({
      date: u.date || "-",
      partId: u.part_id || u.partId,
      partSN: u.part_sn || u.partSN || "",
      type: u.type,
      brand: u.brand,
      model: u.model,
      quantity: Number(u.quantity) || 0,
      sourceBrand: u.source_brand || u.sourceBrand || "",
      sourceModel: u.source_model || u.sourceModel || "",
      sourceSN: u.source_sn || u.sourceSN || "",
      destBrand: u.dest_brand || u.destBrand || "",
      destModel: u.dest_model || u.destModel || "",
      destSN: u.dest_sn || u.destSN || "",
      account: u.account,
      asset: u.asset || "",
      change: u.change || "",
      incident: u.incident || "",
      upgradePlan: u.upgrade_plan || u.upgradePlan || "No",
      // الحماية ضد الـ NaN اللي بتسبب الإيرور
      rawDate: (uDate && !isNaN(uDate.getTime())) ? uDate.getTime() : 0,
      usageId: u.id
    });
  });

  filtered.sort(function(a, b) {
    return b.rawDate - a.rawDate;
  });
  
  return filtered;
}
function saveLaptop(laptopData, isUpdate) {
  // تعديل اسم مصفوفة الرامات عشان توافق Supabase (rams_json)
  if (laptopData.rams) {
    laptopData.rams_json = laptopData.rams;
    delete laptopData.rams;
  }

  // 👇 التعديل الجديد: تحويل mb إلى m_b عشان توافق الداتابيز
  if (laptopData.mb !== undefined) {
    laptopData.m_b = laptopData.mb;
    delete laptopData.mb;
  }

  if (isUpdate) {
    supabaseRequest("laptops?id=eq." + laptopData.id, "PATCH", laptopData);
    return "Updated";
  } else {
    supabaseRequest("laptops", "POST", laptopData);
    try {
      processAllScrappedParts(laptopData); 
    } catch(e) {
      Logger.log("Error auto-adding parts: " + e.toString());
    }
    return "Added";
  }
}

function savePart(partData, isUpdate) {
  // جلب تاريخ اليوم كبديل لو التاريخ مش مبعوت
  var dt = Utilities.formatDate(new Date(), "Africa/Cairo", "yyyy-MM-dd");
  
  // تجهيز البيانات لتتوافق مع أسماء العواميد في Supabase
  var mappedData = {
    type: partData.type,
    brand: partData.brand,
    model: partData.model,
    quantity: partData.quantity,
    initial_quantity: (partData.initial_quantity !== undefined && partData.initial_quantity !== null && partData.initial_quantity !== "") ? partData.initial_quantity : partData.quantity,
    category: partData.category,
    site: partData.site,
    location: partData.location,
    reserved_for: partData.reservedFor || partData.reserved_for || "",
    incident: partData.incident || "",
    purchase_order: partData.purchaseOrder || partData.purchase_order || "",
    date: partData.date || dt,
    comment: partData.comment || ""
  };

  if (partData.id) {
    mappedData.id = partData.id;
  }

  if (isUpdate) {
    supabaseRequest("spareparts?id=eq." + mappedData.id, "PATCH", mappedData);
    return { status: "Updated", id: mappedData.id };
  } else {
    var inserted = supabaseRequest("spareparts", "POST", mappedData);
    var newId = (inserted && inserted[0] && inserted[0].id) ? inserted[0].id : null;
    return { status: "Added", id: newId };
  }
}

function processAllScrappedParts(laptop) {
  var category = "Used (From scrapped laptops)";
  // إضافة قيم افتراضية قوية عشان الـ Supabase API ميضربش لو القيمة فاضية
  var site = laptop.site || "N/A";
  var location = laptop.current_location || "N/A";
  var reservedFor = "Store";
  var incident = laptop.move_incidents || "N/A";
  var comment = "";

  // دالة مساعدة لتشفير القيم للـ URL عشان نتعامل مع المسافات والقيم الفاضية بأمان
  function safeEnc(val) {
    return encodeURIComponent(val ? String(val).trim() : "N/A");
  }

  // دالة مساعدة لإضافة القطعة أو زيادة عددها لو موجودة
  function addPartHelper(type, brand, model) {
    // 1. نبحث في قاعدة البيانات عن كارت مطابق تماماً (استخدام safeEnc)
    var query = "spareparts?type=eq." + safeEnc(type) +
                "&brand=eq." + safeEnc(brand) +
                "&model=eq." + safeEnc(model) +
                "&category=eq." + safeEnc(category) +
                "&site=eq." + safeEnc(site) +
                "&location=eq." + safeEnc(location) +
                "&reserved_for=eq." + safeEnc(reservedFor) +
                "&select=id,quantity,comment";

    try {
      var existingParts = supabaseRequest(query, "GET");

      if (existingParts && existingParts.length > 0) {
        // لو الكارت موجود: بنجيبه ونزود الكمية بمقدار 1
        var existingPart = existingParts[0];
        var newQuantity = Number(existingPart.quantity) + 1;
        var newComment = existingPart.comment || "";
        
        // لو فيه تعليق جديد نضيفه من غير تكرار
        if (comment && newComment.indexOf(comment) === -1) {
          newComment = newComment ? newComment + " | " + comment : comment;
        }

        var updatePayload = {
          quantity: newQuantity,
          comment: newComment
        };

        // نعمل Patch لتحديث الكمية
        supabaseRequest("spareparts?id=eq." + existingPart.id, "PATCH", updatePayload);
      } else {
        // لو الكارت مش موجود: بنعمل كارت جديد
        // شيلنا السطر بتاع Math.random خالص لأن Supabase هيعمله أوتوماتيك

        var partData = {
          // مسحنا سطر الـ id خالص من هنا
          type: type,
          brand: brand,
          model: model,
          quantity: 1,
          category: category,
          site: site,
          location: location,
          reservedFor: reservedFor,
          incident: incident,
          comment: comment
        };
        savePart(partData, false);
      }
    } catch (e) {
      Logger.log("Error finding/updating part: " + e.toString());
      // في حالة الـ Fallback برضه هنشيل توليد الـ ID
      
      var partFallbackData = {
        // مسحنا الـ id من هنا كمان
        type: type, brand: brand, model: model, quantity: 1,
        category: category, site: site, location: location,
        reservedFor: reservedFor, incident: incident, comment: comment
      };
      savePart(partFallbackData, false);
    }
  }

  // نجيب بيانات التوافق
  // نجيب بيانات التوافق
  var groupsData = getData("Groups");
  
  function findGroupModel(compType, laptopModel) {
    if(!laptopModel) return "Unknown";
    var searchType = String(compType).toLowerCase().trim();
    for (var i = 0; i < groupsData.length; i++) {
      var g = groupsData[i];
      var groupCompType = String(g.component_type).toLowerCase().trim();
      var mList = [];
      
      // التعديل هنا: الداتابيز بترجع العمود باسم compatible_models مش models
      var dbModels = g.compatible_models || g.models; 

      if (Array.isArray(dbModels)) {
        mList = dbModels;
      } else if (typeof dbModels === 'string') {
        try {
          mList = JSON.parse(dbModels);
          if (!Array.isArray(mList)) mList = dbModels.split(',');
        } catch (e) {
          mList = dbModels.split(',');
        }
      }
      
      mList = mList.map(function(m) { return String(m).trim(); });
      
      if (groupCompType == searchType && mList.indexOf(laptopModel) > -1) {
        return g.group_name;
      }
    }
    return laptopModel;
  }

  // مراجعة وإضافة كل قطعة لو حالتها سليمة (TRUE)
  if (laptop.hdd === true || String(laptop.hdd).toUpperCase() === 'TRUE') {
    addPartHelper('HDD', 'All', 'All');
  }

  if (laptop.ssd === true || String(laptop.ssd).toUpperCase() === 'TRUE') {
    var ssdType = "SSD";
    var ssdModel = "Generic";
    if (laptop.ssd_type && laptop.ssd_type !== 'Type' && laptop.ssd_type !== '') {
      var parts = laptop.ssd_type.split(' ');
      if (parts.length >= 2) {
        ssdType = parts[0];
        ssdModel = parts.slice(1).join(' ');
      } else {
        ssdModel = laptop.ssd_type;
      }
    }
    addPartHelper(ssdType, 'Generic', ssdModel);
  }

  if (laptop.fan === true || String(laptop.fan).toUpperCase() === 'TRUE') {
    var fanModel = findGroupModel('fan', laptop.laptop_model);
    addPartHelper('Fan', laptop.brand || 'Generic', fanModel);
  }

  if (laptop.battery === true || String(laptop.battery).toUpperCase() === 'TRUE') {
    var battModel = findGroupModel('battery', laptop.laptop_model);
    addPartHelper('Battery', laptop.brand || 'Generic', battModel);
  }

  var rams = laptop.rams_json || laptop.rams;
  if (typeof rams === 'string') {
    try { rams = JSON.parse(rams); } catch (e) { rams = []; }
  }
  if (Array.isArray(rams) && rams.length > 0) {
    rams.forEach(function(ram) {
      if (ram.size && ram.path) {
        var manufacturer = ram.manufacturer || 'Generic';
        var ramModel = ram.size + "GB " + ram.path;
        addPartHelper('RAM', manufacturer, ramModel);
      }
    });
  }
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

function saveUser(params) {
  var email = String(params.email).trim().toLowerCase();
  var existing = supabaseRequest("users?username=eq." + encodeURIComponent(email) + "&select=id");
  
  var userData = {
    username: email,
    password_encoded: params.password,
    permissions_json: typeof params.permissions === 'string' ? params.permissions : JSON.stringify(params.permissions),
    comment: params.comment || ""
  };

  if (existing && existing.length > 0) {
    supabaseRequest("users?username=eq." + encodeURIComponent(email), "PATCH", userData);
    return "User Updated";
  } else {
    supabaseRequest("users", "POST", userData);
    return "User Created";
  }
}

// إعدادات مستلمي إيميلات القوالب (Out of Warranty ...إلخ) - قابلة للتعديل من الأدمن
function getEmailTemplateSettings() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty("EMAIL_TEMPLATE_SETTINGS");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function saveEmailTemplateSettings(params) {
  var key = params.templateKey;
  if (!key) throw new Error("templateKey is required.");
  var props = PropertiesService.getScriptProperties();
  var current = getEmailTemplateSettings();
  current[key] = { to: params.to || "", cc: params.cc || "" };
  props.setProperty("EMAIL_TEMPLATE_SETTINGS", JSON.stringify(current));
  return current;
}

function deleteUser(email) {
  var ce = String(email).trim().toLowerCase();
  supabaseRequest("users?username=eq." + encodeURIComponent(ce), "DELETE");
  return "Deleted";
}
function handleLogin(email, password) {
  var ce = String(email).trim().toLowerCase();
  // البحث عن المستخدم باستخدام الـ username
  var endpoint = "users?username=eq." + encodeURIComponent(ce) + "&select=*";
  var users = supabaseRequest(endpoint, "GET");
  
  if (!users || users.length === 0) return { valid: false };
  
  var user = users[0];
  var p = {};
  try {
    p = (typeof user.permissions_json === 'string') ? JSON.parse(user.permissions_json) : user.permissions_json;
  } catch(e) {}
  
  if (String(user.password_encoded) === String(password)) {
    // بنرجع الإيميل بالشكل الصحيح (case) والـ comment كمان، عشان الواجهة تاخد بيانات فريش
    // من الداتابيز مباشرة بدل ما تعتمد على أي كاش قديم محفوظ في المتصفح
    return { valid: true, permissions: p, email: user.username, comment: user.comment || "" };
  }
  
  return { valid: false };
}
function setupWeeklyTrigger(){ScriptApp.newTrigger("autoBackupDB").timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(23).create()}
function setupMonthlyArchiveTrigger(){ScriptApp.newTrigger("archiveOldLogs").timeBased().everyDays(30).atHour(4).create()}
function execSafe(params){var lock=LockService.getScriptLock();try{lock.waitLock(30000);}catch(e){return{status:"error",message:"Server is busy. Please try again."};}try{var action=params.action;var user=params.user||"Guest/System";var result={};if(action==='getFilteredBrands')return{status:'success',data:getUniqueValuesByFilter(params.type,'brand')};if(action==='getFilteredModels')return{status:'success',data:getUniqueValuesByFilter(params.type,'model',params.brand)};if(action==='verifyPartSN')return{status:'success',data:getPartModelBySerial(params.sn)};if(action==='verifyDeviceSN')return{status:'success',data:verifyAssetSN(params.sn)};if(action=="getLaptops")result=getData("Laptops");else if(action=="getDashboardStats")result=getDashboardStats();else if(action=="getFilteredUsageReport")result=getFilteredUsageReport(params);else if(action=="saveLaptop")result=saveLaptop(params.data,params.isUpdate);else if(action=="deleteBatchLaptops")result=deleteBatchLaptops(params.ids,params.user);else if(action=="getParts")result=getData("SpareParts");else if(action=="savePart")result=savePart(params.data,params.isUpdate);else if(action=="deletePart")result=deleteRow("SpareParts",params.id);else if(action=="deleteDeductRecord")result=deleteRow("DeductHistory",params.id);else if(action=="getEmailTemplateSettings")result=getEmailTemplateSettings();else if(action=="saveEmailTemplateSettings")result=saveEmailTemplateSettings(params);else if(action=="getUsers")result=getUsersData();else if(action=="saveUser")result=saveUser(params);else if(action=="deleteUser")result=deleteUser(params.email);else if(action=="login")result=handleLogin(params.email,params.password);else if(action=="logout")result="Logged out";else if(action=="getGroups")result=getData("Groups");else if(action=="saveGroup")result=saveGroup(params.data);else if(action=="deleteGroup")result=deleteGroup(params.group_name);else if(action=="getLogs")result=getData("Logs");else if(action=="logActivity")result=logActivity(params.user,params.logAction,params.details);else if(action=="logUsage")result=logUsage(params.data);else if(action=="updateUsageRecord")result=updateUsageRecord(params.data);else if(action=="logDeduct")result=logDeduct(params.data);else if(action=="updateDeductRecord")result=updateDeductRecord(params.data);else if(action=="getUsageHistory")result=getData("UsageHistory");else if(action=="getDeductHistory")result=getData("DeductHistory");else if(action=="getDowngrades")result=getData("Downgrade");else if(action=="bulkEditLaptops")result=bulkEditLaptops(params.ids,params.updates,params.user);else if(action=="changePassword")result=changeUserPassword(params.email,params.password);else if(action=="updateComponentStatus")result=updateComponentStatus(params.sn,params.type,params.user);else if(action=="getPartModelBySerial")result=getPartModelBySerial(params.serial);else if(action=="clearLogs")result=clearAllLogs(user);else if(action=="saveDowngrade")result=saveDowngrade(params);else if(action=="downloadFullDB")result=downloadFullDBBase64();else if(action=="getAllInitialData")result={laptops:getData("Laptops"),dashboardStats:getDashboardStats(),parts:getData("SpareParts"),users:getUsersData(),groups:getData("Groups"),logs:getData("Logs"),usageHistory:getData("UsageHistory"),deductHistory:getData("DeductHistory"),downgrades:getData("Downgrade")};else if(action=="processPartUsage")result=processPartUsage(params.data,user);else if(action=="rollbackUsage")result=rollbackPartUsage(params);else if(action=="getDailyWorkEntries")result=getDailyWorkEntries(user);else if(action=="saveDailyWorkEntries")result=saveDailyWorkEntries(user,params.entries);else if(action=="getDeviceTypes")result=getDeviceTypesBySerials(params.serials);else if(action=="saveWarrantyRecord")result=saveWarrantyRecord(params.data,params.isUpdate);else if(action=="deleteWarrantyRecord")result=deleteRow("data",params.id);else if(action=="savePrinter")result=savePrinter(params.data,params.isUpdate);else if(action=="deletePrinter")result=deleteRow("printers",params.id);else if(action=="bulkAddWarrantyRecords")result=bulkAddWarrantyRecords(params.rows);else if(action=="bulkAddPrinters")result=bulkAddPrinters(params.rows);if(!action.startsWith("get")&&action!=="logActivity"&&action!=="login"&&action!=="logout"&&!params.skipLog||action==="getAllDataForExport"||action==="downloadFullDB"){var logDetails=generateLogDetails(action,params,result);logActivity(user,action,logDetails);}if(action==="login")logActivity(params.email,"Login Attempt",result.valid?"Success":"Failed");if(action==="logout")logActivity(user,"Logout","User logged out successfully");return{status:"success",data:result};}catch(error){logActivity(params?params.user:"System","Error: "+(params?params.action:"Unknown"),error.toString());return{status:"error",message:error.toString()};}finally{lock.releaseLock();}}
function generateLogDetails(action,params,result){
  try{
    var d=params.data;
    if(action=="saveLaptop")return(params.isUpdate?"Updated":"Created")+" Laptop | SN: "+(d.serial_number||"N/A")+" | Model: "+d.laptop_model;
    if(action=="deleteBatchLaptops")return"Batch Delete Laptops | "+result;
    if(action=="savePart")return(params.isUpdate?"Updated":"Added")+" Part | Type: "+d.type+" | Brand: "+d.brand+" | Model: "+d.model+" | Qty: "+d.quantity;
    if(action=="deletePart")return"Deleted Part ID: "+params.id;
    if(action=="deleteDeductRecord")return"Deleted Deduct History Record ID: "+params.id;
    if(action=="saveEmailTemplateSettings")return"Updated Email Recipients for template: "+params.templateKey+" | To: "+(params.to||"")+" | CC: "+(params.cc||"");
    if(action=="saveUser")return"User Management: Saved user "+params.email;
    if(action=="deleteUser")return"User Management: Deleted user "+params.email;
    if(action=="changePassword")return"Changed password for "+params.email;
    if(action=="saveGroup")return"Saved Group: "+d.group_name;
    if(action=="deleteGroup")return"Deleted Group: "+params.group_name;
    if(action=="logUsage")return"Usage Recorded: "+d.quantity+"x "+d.type+" for asset/device ("+(d.sourceSN||d.destSN||"N/A")+")";
    if(action=="logDeduct")return"Deduction: "+d.quantity+"x from Part ID "+d.partId+" Reason: "+d.reason;
    if(action=="bulkEditLaptops")return"Bulk Edit: Updated "+params.ids.length+" laptops with changes: "+JSON.stringify(params.updates);
    if(action=="updateComponentStatus")return"Component Status Update: SN "+params.sn+" -> "+params.type+" extracted.";
    if(action=="saveDowngrade")return"Downgraded Part: "+params.type+" "+params.brand+" "+params.model+" Qty: "+params.quantity;
    if(action=="saveDowngradeData")return "Downgraded Part SN: " + params.partSN + " | Model: " + params.partModel + " | Device SN: " + params.deviceSN;
    if(action=="saveWarrantyRecord")return(params.isUpdate?"Updated":"Added")+" Warranty Record | SN: "+(d.serial_number||"N/A")+" | Item: "+(d.item||"N/A");
    if(action=="deleteWarrantyRecord")return"Deleted Warranty Record ID: "+params.id;
    if(action=="savePrinter")return(params.isUpdate?"Updated":"Added")+" Printer | ID: "+(d.printer_id||"N/A")+" | Model: "+(d.printer_model||"N/A");
    if(action=="deletePrinter")return"Deleted Printer ID: "+params.id;
    if(action=="bulkAddWarrantyRecords")return"Bulk Import: Added "+(result&&result.added||0)+" Warranty Record(s)";
    if(action=="bulkAddPrinters")return"Bulk Import: Added "+(result&&result.added||0)+" Printer(s)";
    
    // --- التعديل هنا لعمليات الـ Export ---
    if(action=="downloadFullDB") return "Exported Full Database Backup";
    if(action=="getAllDataForExport") return "Exported Laptops Data";
    
    // منع طباعة أي Object أو داتا كبيرة في اللوجز
    if (typeof result === 'object') {
       if (Array.isArray(result)) return "Action performed on " + result.length + " items.";
       return "Action performed successfully.";
    }
    
    // أي أكشن مش معروف هياخد أول 100 حرف بس من النتيجة عشان يفضل في سطر واحد
    return "Result: " + String(result).substring(0, 100).replace(/\n/g, ' '); 
  }catch(e){return"Action performed (Details parsing error)";}
}
function deleteRow(tableName, id) {
  var tb = tableName.toLowerCase();
  supabaseRequest(tb + "?id=eq." + id, "DELETE");
  return "Deleted";
}
function logActivity(user, action, details) {
  try {
    var timestamp = Utilities.formatDate(new Date(), "Africa/Cairo", "yyyy-MM-dd HH:mm:ss");
    var detailsStr = (typeof details === 'object') ? JSON.stringify(details) : String(details);
    
    var logData = {
      timestamp: timestamp,
      user: user || "Unknown",
      action: action,
      details: detailsStr
    };
    
    supabaseRequest("logs", "POST", logData);
    return "Logged";
  } catch(e) {
    Logger.log("Logging failed: " + e.toString());
    return "Log Failed";
  }
}
// 1. دالة حذف اللابتوبات
function deleteBatchLaptops(ids, user) {
  var idList = ids.join(",");
  // إرسال طلب DELETE للابتوبات التي تطابق الـ IDs
  supabaseRequest("laptops?id=in.(" + idList + ")", "DELETE");
  return "Deleted " + ids.length + " laptops";
}

// 2. دالة تغيير الباسورد للمستخدم
function changeUserPassword(email, newHash) {
  var ce = String(email).trim().toLowerCase();
  supabaseRequest("users?username=eq." + encodeURIComponent(ce), "PATCH", { password_encoded: newHash });
  return "Password Updated Successfully";
}

// دالة إضافة مجمّعة لسجلات الضمان (Bulk Import - Warranty Check)
function bulkAddWarrantyRecords(rows) {
  var payload = (rows || []).map(function(r) {
    return {
      serial_number: r.serial_number,
      item: r.item,
      asset_description: r.asset_description,
      provider: r.provider,
      dis: r.dis,
      warranty_years: r.warranty_years,
      comments: r.comments
    };
  });
  if (payload.length === 0) return { added: 0 };
  supabaseRequest("data", "POST", payload);
  return { added: payload.length };
}
// دالة إضافة مجمّعة للطابعات (Bulk Import - Printers)
function bulkAddPrinters(rows) {
  var payload = (rows || []).map(function(r) {
    return {
      printer_id: r.printer_id,
      printer_model: r.printer_model,
      printer_name_ad: r.printer_name_ad,
      department: r.department,
      printer_ip: r.printer_ip,
      site: r.site,
      current_location: r.current_location,
      status: r.status,
      password: r.password,
      is_modified: !!r.is_modified
    };
  });
  if (payload.length === 0) return { added: 0 };
  supabaseRequest("printers", "POST", payload);
  return { added: payload.length };
}
// دالة حفظ طابعة (Printers)
function savePrinter(data, isUpdate) {
  var payload = {
    printer_id: data.printer_id,
    printer_model: data.printer_model,
    printer_name_ad: data.printer_name_ad,
    department: data.department,
    printer_ip: data.printer_ip,
    site: data.site,
    current_location: data.current_location,
    status: data.status,
    password: data.password,
    is_modified: !!data.is_modified
  };
  if (isUpdate) {
    supabaseRequest("printers?id=eq." + data.id, "PATCH", payload);
    return "Updated";
  } else {
    supabaseRequest("printers", "POST", payload);
    return "Added";
  }
}

// دالة حفظ سجل ضمان (Warranty Check) - جدول data
function saveWarrantyRecord(data, isUpdate) {
  var payload = {
    serial_number: data.serial_number,
    item: data.item,
    asset_description: data.asset_description,
    provider: data.provider,
    dis: data.dis,
    warranty_years: data.warranty_years,
    comments: data.comments
  };
  if (isUpdate) {
    supabaseRequest("data?id=eq." + data.id, "PATCH", payload);
    return "Updated";
  } else {
    supabaseRequest("data", "POST", payload);
    return "Added";
  }
}

// 3. دالة حفظ جروب التوافق (Groups)
function saveGroup(groupData) {
  var payload = {
    group_name: groupData.group_name,
    component_type: groupData.component_type,
    compatible_models: Array.isArray(groupData.models) ? groupData.models.join(",") : groupData.models
  };
  supabaseRequest("groups", "POST", payload);
  return "Group Saved";
}

// 4. دالة حذف جروب
function deleteGroup(groupName) {
  supabaseRequest("groups?group_name=eq." + encodeURIComponent(groupName), "DELETE");
  return "Deleted";
}

// 5. دالة تسجيل استهلاك القطع
function logUsage(data) {
  var timestamp = Utilities.formatDate(new Date(), "Africa/Cairo", "yyyy-MM-dd HH:mm:ss");
  var payload = {
    date: timestamp,
    part_id: data.partId,
    part_sn: data.partSN || "",
    type: data.type,
    brand: data.brand,
    model: data.model,
    quantity: data.quantity,
    source_brand: data.sourceBrand || "",
    source_model: data.sourceModel || "",
    source_sn: data.sourceSN || "",
    dest_brand: data.destBrand || "",
    dest_model: data.destModel || "",
    dest_sn: data.destSN || "",
    account: data.account,
    asset: data.asset || "",
    change: data.change || "",
    incident: data.incident || "",
    upgrade_plan: data.upgradePlan || "No"
  };
  supabaseRequest("usagehistory", "POST", payload);
  return "Usage Recorded";
}

// 6c. تعديل سجل استخدام موجود
function updateUsageRecord(data) {
  if (!data || !data.id) throw new Error("Usage record ID not provided.");
  var payload = {
    part_sn: data.partSN || "",
    quantity: data.quantity,
    source_brand: data.sourceBrand || "",
    source_model: data.sourceModel || "",
    source_sn: data.sourceSN || "",
    dest_brand: data.destBrand || "",
    dest_model: data.destModel || "",
    dest_sn: data.destSN || "",
    account: data.account || "",
    asset: data.asset || "",
    change: data.change || "",
    incident: data.incident || "",
    upgrade_plan: data.upgradePlan || "No"
  };
  supabaseRequest("usagehistory?id=eq." + data.id, "PATCH", payload);
  return "Usage Record Updated";
}

// 6. دالة تسجيل خصم القطع
function logDeduct(data) {
  var timestamp = Utilities.formatDate(new Date(), "Africa/Cairo", "yyyy-MM-dd HH:mm:ss");
  var payload = {
    date: timestamp,
    part_id: data.partId,
    type: data.type,
    brand: data.brand,
    model: data.model,
    quantity: data.quantity,
    reason: data.reason || "",
    account: data.account || ""
  };
  supabaseRequest("deducthistory", "POST", payload);
  return "Deduction Recorded";
}

// 6b. دالة تعديل سجل خصم موجود (تستخدم في حالة "Return to Store")
function updateDeductRecord(data) {
  if (!data || !data.id) throw new Error("Deduct record ID not provided.");
  var payload = {};
  if (data.quantity !== undefined) payload.quantity = data.quantity;
  if (data.reason !== undefined) payload.reason = data.reason;
  supabaseRequest("deducthistory?id=eq." + data.id, "PATCH", payload);
  return "Deduct Record Updated";
}

// 7. دالة التعديل الجماعي للابتوبات
function bulkEditLaptops(ids, updates, user) {
  var idList = ids.join(",");
  supabaseRequest("laptops?id=in.(" + idList + ")", "PATCH", updates);
  return "Updated " + ids.length + " laptops";
}

// 8. تحديث حالة القطعة بعد استخراجها من لابتوب
function updateComponentStatus(sn, t, u) {
  var tl = String(t).toLowerCase().trim();
  var th = "";
  if (tl.includes("screen")) th = "screen";
  else if (tl.includes("keyboard")) th = "keyboard";
  else if (tl.includes("touchpad")) th = "touchpad";
  else if (tl.includes("hing")) th = "hing";
  else if (tl.includes("frame a")) th = "frame_a";
  else if (tl.includes("frame b")) th = "frame_b";
  else if (tl.includes("frame c")) th = "frame_c";
  else if (tl.includes("frame d")) th = "frame_d";
  else if (tl.includes("frame e")) th = "frame_e";
  else th = t.toLowerCase().replace(/ /g, "_");

  var payload = {};
  payload[th] = false; // تغيير الحالة إلى "لا تعمل"
  
  supabaseRequest("laptops?serial_number=eq." + encodeURIComponent(sn), "PATCH", payload);
  return "Success: Marked " + th + " as No";
}

// 9. مسح جميع السجلات (Logs)
function clearAllLogs(user) {
  // مسح جميع السجلات (بشرط وهمي ليقوم بمسح الكل)
  supabaseRequest("logs?id=not.is.null", "DELETE");
  var timestamp = Utilities.formatDate(new Date(), "Africa/Cairo", "yyyy-MM-dd HH:mm:ss");
  supabaseRequest("logs", "POST", {
    timestamp: timestamp,
    user: user || "System",
    action: "Clear Logs",
    details: "All activity logs were permanently deleted."
  });
  return "Logs Cleared";
}

// 10. أرشفة السجلات القديمة
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

// 11. إضافة Downgrade
function saveDowngrade(p) {
  var dt = Utilities.formatDate(new Date(), "Africa/Cairo", "yyyy-MM-dd HH:mm:ss");
  var payload = {
    timestamp: dt,
    type: p.type,
    brand: p.brand,
    model: p.model,
    part_sn: p.partSN || "",
    part_model: p.partModel || "",
    device_brand: p.deviceBrand || "",
    device_model: p.deviceModel || "",
    device_sn: p.deviceSN || "",
    qty: p.quantity,
    reason: p.reason,
    user: p.user || ""
  };
  supabaseRequest("downgrade", "POST", payload);
  return "Saved";
}

// 11b. حفظ/قراءة Daily Work Log لكل يوزر — باستخدام PropertiesService بتاع Apps Script نفسه (مش قاعدة بيانات Supabase)
function getDailyWorkEntries(user) {
  var key = "dailyWork_" + user;
  var raw = PropertiesService.getScriptProperties().getProperty(key);
  return raw ? JSON.parse(raw) : [];
}

function saveDailyWorkEntries(user, entries) {
  var key = "dailyWork_" + user;
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(entries || []));
  return "Saved";
}



// 12. البحث عن الموديل باستخدام السيريال من جدول الـ Warranty Data
function getPartModelBySerial(serial) {
  var searchSerial = String(serial).trim().toLowerCase();
  var response = supabaseRequest("data?serial_number=ilike." + encodeURIComponent(searchSerial) + "&select=asset_description");
  if (response && response.length > 0) {
    return response[0].asset_description;
  }
  return null;
}

// 12b. تحديد نوع الأجهزة (Laptop/Desktop) لمجموعة سرايل دفعة واحدة — Request واحد بس بدل واحد لكل جهاز
function getDeviceTypesBySerials(serials) {
  var result = {};
  if (!serials || !serials.length) return result;
  var response = supabaseRequest("data?select=serial_number,item");
  var lookup = {};
  if (response) {
    response.forEach(function(row) {
      if (row.serial_number) lookup[String(row.serial_number).trim().toLowerCase()] = row.item;
    });
  }
  serials.forEach(function(sn) {
    var key = String(sn).trim().toLowerCase();
    var item = lookup[key];
    var deviceType = "Laptop/Desktop";
    if (item) {
      var itemLower = String(item).toLowerCase();
      if (itemLower.indexOf("desktop") !== -1) deviceType = "Desktop";
      else if (itemLower.indexOf("laptop") !== -1) deviceType = "Laptop";
    }
    result[sn] = deviceType;
  });
  return result;
}

// 13. الدوال المساعدة للبحث المتقدم (Unique & Lookup)
function getUniqueValuesByFilter(type, targetField, brandFilter) {
  var tf = targetField === 'brand' ? 'brand' : 'model';
  var query = "spareparts?type=eq." + encodeURIComponent(type) + "&select=" + tf;
  if(brandFilter) query += "&brand=eq." + encodeURIComponent(brandFilter);
  
  var data = supabaseRequest(query);
  if(!data) return [];
  var unique = [];
  data.forEach(function(row) {
    var val = row[tf];
    if(val && unique.indexOf(val) === -1) unique.push(val);
  });
  return unique.sort();
}

function verifyAssetSN(sn) {
  var searchSn = String(sn).trim().toLowerCase();
  var response = supabaseRequest("assets?serial_number=ilike." + encodeURIComponent(searchSn) + "&select=model");
  if(response && response.length > 0) return response[0].model;
  return null;
}

function rollbackPartUsage(params) {
  var usageId = params.usageId;
  var partId = params.partId;
  var quantity = params.quantity;

  if (!usageId) throw new Error("Usage ID not provided.");

  // 1. حذف السجل باستخدام الـ ID المباشر
  supabaseRequest("usagehistory?id=eq." + usageId, "DELETE");

  // 2. استرجاع الكمية إلى المخزن
  var part = supabaseRequest("spareparts?id=eq." + partId);
  if (part && part.length > 0) {
    var currentQty = Number(part[0].quantity) || 0;
    supabaseRequest("spareparts?id=eq." + partId, "PATCH", { quantity: currentQty + quantity });
  } else {
    throw new Error("Usage record deleted, but original Part ID not found in Stock to return quantity.");
  }
  return "Rollback successful";
}

// 15. النسخ الاحتياطية
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

function downloadFullDBBase64() {
  // نقوم بجلب البيانات كـ JSON وإرسالها للواجهة لتقوم بتحويلها إلى Excel
  var fullData = {
    laptops: getData("Laptops"),
    spareparts: getData("SpareParts"),
    usagehistory: getData("UsageHistory"),
    deducthistory: getData("DeductHistory"),
    logs: getData("Logs")
  };
  // نقوم بتشفير البيانات كـ Base64
  return Utilities.base64Encode(JSON.stringify(fullData));
}
function processPartUsage(data, user) {
  if (data.logPayloads && data.logPayloads.length > 0) {
    data.logPayloads.forEach(function(payload) {
      logUsage(payload);
    });
  }
  if (data.componentStatusUpdates && data.componentStatusUpdates.length > 0) {
    data.componentStatusUpdates.forEach(function(comp) {
      updateComponentStatus(comp.sn, comp.type, comp.user);
    });
  }
  return "Usage processed successfully";
}