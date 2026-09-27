/**
 * ============================================================
 * Design Queue Management System — Google Apps Script Backend
 * ============================================================
 * Deploy as: Web App → Execute as Me → Anyone can access
 * Sheets required: 'Users', 'Jobs' (run initializeSheets() once)
 * ============================================================
 */

// ─── CONFIGURATION ──────────────────────────────────────────
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',   // ← Replace
  USERS_SHEET:    'Users',
  JOBS_SHEET:     'Jobs',
};

// ─── WEB APP ENTRY POINTS ──────────────────────────────────

function doGet(e)  { return _handleRequest(e); }
function doPost(e) { return _handleRequest(e); }

/**
 * Unified request handler — parses params from GET query‑string
 * or POST JSON body, routes to the correct action, and returns
 * a JSON response via ContentService.
 */
function _handleRequest(e) {
  try {
    var params;
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter || {};
    }

    var action = params.action;
    var result;

    switch (action) {
      // ── User actions ──
      case 'getUser':         result = getUser(params.email);                                         break;
      case 'registerUser':    result = registerUser(params);                                          break;
      case 'getAllUsers':      result = getAllUsers();                                                 break;
      case 'getDesigners':    result = getDesigners();                                                break;
      case 'updateUserRoles': result = updateUserRoles(params.email, params.roles, params.department);break;
      case 'deleteUser':      result = deleteUser(params.email);                                      break;

      // ── Job actions ──
      case 'createJob':       result = createJob(params);                                             break;
      case 'getJobs':         result = getJobs(params);                                               break;
      case 'acknowledgeJob':  result = acknowledgeJob(params.jobId, params.approverEmail, params.approverName); break;
      case 'approveJob':      result = approveJob(params.jobId, params.approverEmail, params.approverName, params.designerEmail); break;
      case 'cancelJob':       result = cancelJob(params.jobId, params.approverEmail, params.approverName, params.reason); break;
      case 'completeJob':     result = completeJob(params.jobId);                                     break;
      case 'editJob':         result = editJob(params.jobId, params.updates);                         break;
      case 'deleteJob':       result = deleteJob(params.jobId);                                       break;

      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    return _jsonResponse(result);
  } catch (err) {
    return _jsonResponse({ success: false, error: err.toString() });
  }
}

// ─── RESPONSE HELPER ────────────────────────────────────────

function _jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── SHEET & HEADER HELPERS ─────────────────────────────────

function _getSheet(name) {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name);
}

/**
 * Build a map { headerName → 0‑based column index }.
 * Allows columns to be reordered without breaking logic.
 */
function _headerMap(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[headers[i]] = i;
  }
  return map;
}

/** Convert a row array into an object using a header map. */
function _rowToObject(row, hmap) {
  var obj = {};
  for (var key in hmap) {
    obj[key] = row[hmap[key]] !== undefined ? row[hmap[key]] : '';
  }
  return obj;
}

function _generateJobId() {
  return 'JOB-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
}

function _generateUID() {
  return 'USR-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

function _now() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

// ─── LOCK HELPER ────────────────────────────────────────────

/**
 * Acquire a script‑wide lock before any write operation.
 * Timeout after 15 s to avoid infinite blocking.
 */
function _acquireLock() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  return lock;
}

// ═══════════════════════════════════════════════════════════
//  USER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function getUser(email) {
  var sheet = _getSheet(CONFIG.USERS_SHEET);
  var hmap  = _headerMap(sheet);
  var data  = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][hmap['Email']]).toLowerCase() === email.toLowerCase()) {
      var rolesRaw = String(data[i][hmap['Roles']] || 'User');
      return {
        success: true,
        user: {
          uid:         data[i][hmap['UID']],
          email:       data[i][hmap['Email']],
          profilePic:  data[i][hmap['ProfilePic']],
          username:    data[i][hmap['Username']],
          nickname:    data[i][hmap['Nickname']],
          roles:       rolesRaw.split(',').map(function(r){ return r.trim(); }),
          department:  data[i][hmap['Department']] || '',
          createdAt:   data[i][hmap['CreatedAt']]
        }
      };
    }
  }
  return { success: true, user: null };
}

function registerUser(params) {
  var lock = _acquireLock();
  try {
    var existing = getUser(params.email);
    if (existing.user) return { success: false, error: 'User already registered.' };

    var sheet = _getSheet(CONFIG.USERS_SHEET);
    var hmap  = _headerMap(sheet);
    var uid   = _generateUID();

    // Build row in header order
    var row = [];
    row[hmap['UID']]        = uid;
    row[hmap['Email']]      = params.email;
    row[hmap['ProfilePic']] = params.profilePic || '';
    row[hmap['Username']]   = params.username;
    row[hmap['Nickname']]   = params.nickname;
    row[hmap['Roles']]      = params.roles || 'User';
    row[hmap['Department']] = params.department || '';
    row[hmap['CreatedAt']]  = _now();

    sheet.appendRow(row);

    return {
      success: true,
      user: {
        uid: uid,
        email: params.email,
        profilePic: params.profilePic || '',
        username: params.username,
        nickname: params.nickname,
        roles: (params.roles || 'User').split(',').map(function(r){ return r.trim(); }),
        department: params.department || '',
        createdAt: row[hmap['CreatedAt']]
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function getAllUsers() {
  var sheet = _getSheet(CONFIG.USERS_SHEET);
  var hmap  = _headerMap(sheet);
  var data  = sheet.getDataRange().getValues();
  var users = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][hmap['Email']]) continue;
    users.push({
      uid:        data[i][hmap['UID']],
      email:      data[i][hmap['Email']],
      profilePic: data[i][hmap['ProfilePic']],
      username:   data[i][hmap['Username']],
      nickname:   data[i][hmap['Nickname']],
      roles:      String(data[i][hmap['Roles']] || 'User').split(',').map(function(r){ return r.trim(); }),
      department: data[i][hmap['Department']] || '',
      createdAt:  data[i][hmap['CreatedAt']]
    });
  }
  return { success: true, users: users };
}

function getDesigners() {
  var sheet = _getSheet(CONFIG.USERS_SHEET);
  var hmap  = _headerMap(sheet);
  var data  = sheet.getDataRange().getValues();
  var designers = [];

  for (var i = 1; i < data.length; i++) {
    var roles = String(data[i][hmap['Roles']] || '').split(',').map(function(r){ return r.trim(); });
    if (roles.indexOf('Designer') !== -1) {
      designers.push({
        email:    data[i][hmap['Email']],
        username: data[i][hmap['Username']],
        nickname: data[i][hmap['Nickname']]
      });
    }
  }
  return { success: true, designers: designers };
}

function updateUserRoles(email, roles, department) {
  var lock = _acquireLock();
  try {
    var sheet = _getSheet(CONFIG.USERS_SHEET);
    var hmap  = _headerMap(sheet);
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][hmap['Email']]).toLowerCase() === email.toLowerCase()) {
        sheet.getRange(i + 1, hmap['Roles'] + 1).setValue(roles);
        if (department !== undefined && department !== null) {
          sheet.getRange(i + 1, hmap['Department'] + 1).setValue(department);
        }
        return { success: true, message: 'Roles updated for ' + email };
      }
    }
    return { success: false, error: 'User not found.' };
  } finally {
    lock.releaseLock();
  }
}

function deleteUser(email) {
  var lock = _acquireLock();
  try {
    var sheet = _getSheet(CONFIG.USERS_SHEET);
    var hmap  = _headerMap(sheet);
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][hmap['Email']]).toLowerCase() === email.toLowerCase()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'User deleted.' };
      }
    }
    return { success: false, error: 'User not found.' };
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════════════════════
//  JOB FUNCTIONS
// ═══════════════════════════════════════════════════════════

function createJob(params) {
  var lock = _acquireLock();
  try {
    var sheet = _getSheet(CONFIG.JOBS_SHEET);
    var hmap  = _headerMap(sheet);
    var jobId = _generateJobId();
    var now   = _now();

    var row = [];
    row[hmap['JobID']]           = jobId;
    row[hmap['RequestDate']]     = now;
    row[hmap['RequesterEmail']]  = params.requesterEmail;
    row[hmap['RequesterName']]   = params.requesterName;
    row[hmap['Department']]      = params.department;
    row[hmap['JobCategory']]     = params.jobCategory;
    row[hmap['JobDetails']]      = params.jobDetails || '';
    row[hmap['ProjectName']]     = params.projectName;
    row[hmap['UseDate']]         = params.useDate || '';
    row[hmap['DeliveryMethod']]  = params.deliveryMethod;
    row[hmap['DeliveryDetail']]  = params.deliveryDetail || '';
    row[hmap['DueDate']]         = params.dueDate;
    row[hmap['Exec1_Status']]    = '';
    row[hmap['Exec1_Name']]      = '';
    row[hmap['Exec2_Status']]    = '';
    row[hmap['Exec2_Name']]      = '';
    row[hmap['AssignedDesigner']] = '';
    row[hmap['JobStatus']]       = 'Pending';
    row[hmap['CancelReason']]    = '';
    row[hmap['CompletedDate']]   = '';

    sheet.appendRow(row);
    return { success: true, jobId: jobId, message: 'Request submitted successfully.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * getJobs — flexible query endpoint.
 *
 * params.filterType:
 *   'user'     → requester's own jobs
 *   'exec1'    → Pending jobs from the caller's department
 *   'exec2'    → Acknowledged (Exec1‑approved) jobs
 *   'designer' → jobs assigned to designer + Acknowledged placeholders
 *   'admin'    → everything
 *   (omit)     → everything
 *
 * Optional: params.status, params.department, params.email
 */
function getJobs(params) {
  var sheet = _getSheet(CONFIG.JOBS_SHEET);
  var hmap  = _headerMap(sheet);
  var data  = sheet.getDataRange().getValues();
  var jobs  = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][hmap['JobID']]) continue;

    var job = _rowToObject(data[i], hmap);
    var include = true;

    var ft = params.filterType || 'admin';

    if (ft === 'user') {
      include = String(job.RequesterEmail).toLowerCase() === String(params.email).toLowerCase();
    } else if (ft === 'exec1') {
      include = job.JobStatus === 'Pending'
                && (!params.department || job.Department === params.department);
    } else if (ft === 'exec2') {
      include = job.JobStatus === 'Acknowledged';
    } else if (ft === 'designer') {
      var isAssigned = String(job.AssignedDesigner).toLowerCase() === String(params.email).toLowerCase();
      var isPlaceholder = job.JobStatus === 'Acknowledged';
      include = isAssigned || isPlaceholder;
    }
    // admin → include everything

    // Additional status filter
    if (params.status && include) {
      include = job.JobStatus === params.status;
    }

    if (include) {
      jobs.push(job);
    }
  }

  return { success: true, jobs: jobs };
}

/** Locate a job row by ID. Returns { sheet, rowNum (1‑based), data (row array), hmap } or null. */
function _findJobRow(jobId) {
  var sheet = _getSheet(CONFIG.JOBS_SHEET);
  var hmap  = _headerMap(sheet);
  var data  = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][hmap['JobID']] === jobId) {
      return { sheet: sheet, rowNum: i + 1, data: data[i], hmap: hmap };
    }
  }
  return null;
}

function acknowledgeJob(jobId, approverEmail, approverName) {
  var lock = _acquireLock();
  try {
    var f = _findJobRow(jobId);
    if (!f) return { success: false, error: 'Job not found.' };
    if (f.data[f.hmap['JobStatus']] !== 'Pending') {
      return { success: false, error: 'Job is not in Pending status.' };
    }

    var h = f.hmap;
    f.sheet.getRange(f.rowNum, h['JobStatus']    + 1).setValue('Acknowledged');
    f.sheet.getRange(f.rowNum, h['Exec1_Status'] + 1).setValue('Approved');
    f.sheet.getRange(f.rowNum, h['Exec1_Name']   + 1).setValue(approverName || approverEmail);

    return { success: true, message: 'Job acknowledged.' };
  } finally {
    lock.releaseLock();
  }
}

function approveJob(jobId, approverEmail, approverName, designerEmail) {
  var lock = _acquireLock();
  try {
    var f = _findJobRow(jobId);
    if (!f) return { success: false, error: 'Job not found.' };
    if (f.data[f.hmap['JobStatus']] !== 'Acknowledged') {
      return { success: false, error: 'Job must be Acknowledged first.' };
    }

    // Look up designer display name
    var dInfo = getUser(designerEmail);
    var designerName = (dInfo.user ? dInfo.user.username : designerEmail);

    var h = f.hmap;
    f.sheet.getRange(f.rowNum, h['JobStatus']         + 1).setValue('In Progress');
    f.sheet.getRange(f.rowNum, h['Exec2_Status']      + 1).setValue('Approved');
    f.sheet.getRange(f.rowNum, h['Exec2_Name']        + 1).setValue(approverName || approverEmail);
    f.sheet.getRange(f.rowNum, h['AssignedDesigner']   + 1).setValue(designerEmail);

    // Send notification emails
    var jobObj = _rowToObject(f.data, h);
    jobObj.JobStatus = 'In Progress';
    jobObj.AssignedDesigner = designerEmail;
    _sendApprovalEmail(jobObj, designerEmail, designerName);

    return { success: true, message: 'Job approved → assigned to ' + designerName };
  } finally {
    lock.releaseLock();
  }
}

function cancelJob(jobId, approverEmail, approverName, reason) {
  var lock = _acquireLock();
  try {
    var f = _findJobRow(jobId);
    if (!f) return { success: false, error: 'Job not found.' };

    var h = f.hmap;
    f.sheet.getRange(f.rowNum, h['JobStatus']     + 1).setValue('Cancelled');
    f.sheet.getRange(f.rowNum, h['Exec2_Status']  + 1).setValue('Cancelled');
    f.sheet.getRange(f.rowNum, h['Exec2_Name']    + 1).setValue(approverName || approverEmail);
    f.sheet.getRange(f.rowNum, h['CancelReason']  + 1).setValue(reason || '');

    var jobObj = _rowToObject(f.data, h);
    _sendCancellationEmail(jobObj, reason);

    return { success: true, message: 'Job cancelled.' };
  } finally {
    lock.releaseLock();
  }
}

function completeJob(jobId) {
  var lock = _acquireLock();
  try {
    var f = _findJobRow(jobId);
    if (!f) return { success: false, error: 'Job not found.' };
    if (f.data[f.hmap['JobStatus']] !== 'In Progress') {
      return { success: false, error: 'Job is not In Progress.' };
    }

    var h = f.hmap;
    f.sheet.getRange(f.rowNum, h['JobStatus']      + 1).setValue('Completed');
    f.sheet.getRange(f.rowNum, h['CompletedDate']  + 1).setValue(_now());

    return { success: true, message: 'Job completed!' };
  } finally {
    lock.releaseLock();
  }
}

function editJob(jobId, updates) {
  var lock = _acquireLock();
  try {
    var f = _findJobRow(jobId);
    if (!f) return { success: false, error: 'Job not found.' };

    var h = f.hmap;
    for (var key in updates) {
      if (h.hasOwnProperty(key)) {
        f.sheet.getRange(f.rowNum, h[key] + 1).setValue(updates[key]);
      }
    }
    return { success: true, message: 'Job updated.' };
  } finally {
    lock.releaseLock();
  }
}

function deleteJob(jobId) {
  var lock = _acquireLock();
  try {
    var f = _findJobRow(jobId);
    if (!f) return { success: false, error: 'Job not found.' };
    f.sheet.deleteRow(f.rowNum);
    return { success: true, message: 'Job deleted.' };
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════════════════════
//  EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

function _sendApprovalEmail(job, designerEmail, designerName) {
  var subject = '✅ Design Request Approved: ' + job.ProjectName;
  var htmlBody = '<div style="font-family:\'Segoe UI\',Arial,sans-serif;max-width:600px;margin:0 auto">'
    + '<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;border-radius:12px 12px 0 0">'
    + '<h2 style="color:#fff;margin:0;font-size:20px">Design Request Approved ✅</h2></div>'
    + '<div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;background:#fff">'
    + '<p style="color:#334155">Your design request has been approved and assigned to a designer.</p>'
    + '<table style="width:100%;border-collapse:collapse;margin:16px 0">'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9">Project</td>'
    + '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">' + job.ProjectName + '</td></tr>'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9">Service</td>'
    + '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">' + job.JobCategory + '</td></tr>'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9">Designer</td>'
    + '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">' + designerName + '</td></tr>'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569">Due Date</td>'
    + '<td style="padding:10px 12px">' + job.DueDate + '</td></tr>'
    + '</table></div></div>';

  _trySendEmail(job.RequesterEmail, subject, htmlBody);

  // Notify designer
  var dSubject = '🎨 New Assignment: ' + job.ProjectName;
  var dBody = '<div style="font-family:\'Segoe UI\',Arial,sans-serif;max-width:600px;margin:0 auto">'
    + '<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;border-radius:12px 12px 0 0">'
    + '<h2 style="color:#fff;margin:0;font-size:20px">New Design Assignment 🎨</h2></div>'
    + '<div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;background:#fff">'
    + '<p style="color:#334155">You have been assigned a new design job.</p>'
    + '<table style="width:100%;border-collapse:collapse;margin:16px 0">'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9">Project</td>'
    + '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">' + job.ProjectName + '</td></tr>'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9">Service</td>'
    + '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">' + job.JobCategory + '</td></tr>'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9">Requester</td>'
    + '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">' + job.RequesterName + '</td></tr>'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9">Department</td>'
    + '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">' + job.Department + '</td></tr>'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9">Due Date</td>'
    + '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">' + job.DueDate + '</td></tr>'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569">Delivery</td>'
    + '<td style="padding:10px 12px">' + job.DeliveryMethod + '</td></tr>'
    + '</table></div></div>';

  _trySendEmail(designerEmail, dSubject, dBody);
}

function _sendCancellationEmail(job, reason) {
  var subject = '❌ Design Request Cancelled: ' + job.ProjectName;
  var htmlBody = '<div style="font-family:\'Segoe UI\',Arial,sans-serif;max-width:600px;margin:0 auto">'
    + '<div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:24px;border-radius:12px 12px 0 0">'
    + '<h2 style="color:#fff;margin:0;font-size:20px">Request Cancelled ❌</h2></div>'
    + '<div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;background:#fff">'
    + '<p style="color:#334155">Your design request has been cancelled.</p>'
    + '<table style="width:100%;border-collapse:collapse;margin:16px 0">'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9">Project</td>'
    + '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">' + job.ProjectName + '</td></tr>'
    + '<tr><td style="padding:10px 12px;font-weight:600;color:#ef4444">Reason</td>'
    + '<td style="padding:10px 12px;color:#ef4444;font-weight:500">' + (reason || 'No reason provided') + '</td></tr>'
    + '</table>'
    + '<p style="margin-top:12px;color:#94a3b8;font-size:14px">Contact the department assigner for further details.</p>'
    + '</div></div>';

  _trySendEmail(job.RequesterEmail, subject, htmlBody);

  // Also notify designer if already assigned
  if (job.AssignedDesigner) {
    _trySendEmail(job.AssignedDesigner, '❌ Job Cancelled: ' + job.ProjectName, htmlBody);
  }
}

function _trySendEmail(to, subject, htmlBody) {
  try {
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: htmlBody });
  } catch (e) {
    Logger.log('Email failed (' + to + '): ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  INITIALISATION — Run once from the Apps Script editor
// ═══════════════════════════════════════════════════════════

function initializeSheets() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // Users sheet
  var us = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (!us) {
    us = ss.insertSheet(CONFIG.USERS_SHEET);
    us.appendRow(['UID', 'Email', 'ProfilePic', 'Username', 'Nickname', 'Roles', 'Department', 'CreatedAt']);
    us.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f1f5f9');
    us.setFrozenRows(1);
  }

  // Jobs sheet
  var js = ss.getSheetByName(CONFIG.JOBS_SHEET);
  if (!js) {
    js = ss.insertSheet(CONFIG.JOBS_SHEET);
    js.appendRow([
      'JobID', 'RequestDate', 'RequesterEmail', 'RequesterName', 'Department',
      'JobCategory', 'JobDetails', 'ProjectName', 'UseDate', 'DeliveryMethod',
      'DeliveryDetail', 'DueDate', 'Exec1_Status', 'Exec1_Name', 'Exec2_Status',
      'Exec2_Name', 'AssignedDesigner', 'JobStatus', 'CancelReason', 'CompletedDate'
    ]);
    js.getRange(1, 1, 1, 20).setFontWeight('bold').setBackground('#f1f5f9');
    js.setFrozenRows(1);
  }

  Logger.log('✅ Sheets initialised successfully.');
}
