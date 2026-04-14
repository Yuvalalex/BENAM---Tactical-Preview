const OVERLAY_TEMPLATE_HTML = `
  <!-- ═══ NEW OVERLAYS ═══ -->
  <div id="evac-pkg-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>
  <div id="sabcde-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>
  <div id="tolarn-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>
  <div id="pfc-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>
  <div id="crush-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>
  <div id="blast-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>
  <div id="hypother-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>
  <div id="comms-log-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>
  <div id="lz-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>
  <div id="crew-overlay"
    style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.96);z-index:490;overflow-y:auto;"></div>

  <!-- ════ CASUALTY DRAWER ════ -->
  <div class="drawer-overlay" id="drawer-overlay" onclick="closeDrawer()"></div>
  <div class="cas-drawer" id="cas-drawer">
    <div class="drawer-handle" onclick="closeDrawer()"></div>
    <div class="drawer-header" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px 6px">
      <div id="drawer-prio-badge" class="prio pt1">T1</div>
      <div id="drawer-cas-name" style="font-size:18px;font-weight:900">פצוע</div>
      <div id="drawer-cas-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"></div>
      <div class="drawer-close" onclick="closeDrawer()" style="margin-right:auto">✕</div>
    </div>
    <div class="drawer-body" id="drawer-body"></div>
  </div>

  <!-- ════ FAB -- Quick Actions (bottom-left) ════ -->
  <button id="quick-fab" onclick="toggleQuickActions(event)" aria-label="פעולות מהירות">＋</button>
  <button id="quick-add-cas" class="qa-item qa-item-addcas" onclick="closeQuickActions();openAddCas()"><span class="qa-item-icon">🩸</span><span class="qa-item-label">הוסף פגוע</span></button>
  <div id="quick-actions-menu">
    <div class="qa-item" onclick="closeQuickActions();goReportTools()"><span class="qa-item-icon">📋</span><span class="qa-item-label">דו"ח</span></div>
    <div class="qa-item" onclick="closeQuickActions();openEvacQueue()"><span class="qa-item-icon">🚁</span><span class="qa-item-label">קרא פינוי</span></div>
    <div class="qa-item" onclick="closeQuickActions();openToolsMenu()"><span class="qa-item-icon">⋯</span><span class="qa-item-label">עוד</span></div>
  </div>

  <!-- ═══ TRAINING MODE OVERLAY ═══ -->
  <div id="training-overlay"
    style="display:none;position:fixed;inset:0;z-index:9500;background:#060908;overflow-y:auto">
    <div style="padding:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:24px">🎓</span>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:900;color:#c0a0ff">TRAINING MODE</div>
          <div style="font-size:9px;color:#8060e0">תרגול תרחישים — ציון אוטומטי</div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="closeTraining()" style="color:#c0a0ff;border-color:#6040d0">✕
          סגור</button>
      </div>

      <div id="training-active"
        style="display:none;background:linear-gradient(135deg,#1a0830,#0a0020);border:2px solid #6040d0;border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-size:28px;animation:pulse 2s ease-in-out infinite">⏱</div>
          <div style="flex:1">
            <div id="training-scenario-name" style="font-size:13px;font-weight:900;color:#c0a0ff">—</div>
            <div id="training-timer" style="font-size:22px;font-weight:900;font-family:var(--font-mono);color:#e0c0ff">
              00:00</div>
          </div>
          <button class="btn btn-sm btn-red" onclick="endTraining()" style="border-radius:8px">⏹ סיים</button>
        </div>
      </div>

      <div id="training-scenarios" style="display:flex;flex-direction:column;gap:8px">
        <div class="train-card" onclick="startTraining('open')">
          <div class="train-icon">🌄</div>
          <div class="train-info">
            <div class="train-title">ארן שטח פתוח</div>
            <div class="train-desc">3 פגועים, ירי ישיר, LZ זמין</div>
          </div>
          <div class="train-diff" style="color:var(--green3)">קל</div>
        </div>
        <div class="train-card" onclick="startTraining('urban')">
          <div class="train-icon">🏙</div>
          <div class="train-info">
            <div class="train-title">ארן עירוני</div>
            <div class="train-desc">5 פגועים, פיצוץ + ירי, אין LZ</div>
          </div>
          <div class="train-diff" style="color:var(--amber3)">בינוני</div>
        </div>
        <div class="train-card" onclick="startTraining('pfc')">
          <div class="train-icon">🏚</div>
          <div class="train-info">
            <div class="train-title">PFC — טיפול ממושך</div>
            <div class="train-desc">2 פגועים T1, פינוי מאוחר, TXA+Blood</div>
          </div>
          <div class="train-diff" style="color:var(--amber3)">בינוני</div>
        </div>
        <div class="train-card" onclick="startTraining('mass')">
          <div class="train-icon">💥</div>
          <div class="train-info">
            <div class="train-title">Mass Casualty — 10+</div>
            <div class="train-desc">10 פגועים, START triage, משאבים מוגבלים</div>
          </div>
          <div class="train-diff" style="color:var(--red3)">קשה</div>
        </div>
        <div class="train-card" onclick="startTraining('lms')">
          <div class="train-icon">🌑</div>
          <div class="train-info">
            <div class="train-title">LMS — ארב לילי</div>
            <div class="train-desc">4 פגועים, חושך, תקשורת מוגבלת</div>
          </div>
          <div class="train-diff" style="color:var(--red3)">קשה</div>
        </div>
      </div>

      <div style="margin-top:14px">
        <div style="font-size:10px;color:#8060e0;font-weight:700;letter-spacing:.1em;margin-bottom:6px">📊 תוצאות
          אחרונות</div>
        <div id="training-history" style="font-size:11px;color:var(--muted)">אין תוצאות עדיין</div>
      </div>
    </div>
  </div>

  <!-- ═══ TUTORIAL OVERLAY ═══ -->
  <div id="tutorial-overlay"
    style="display:none;position:fixed;inset:0;z-index:9600;background:rgba(6,9,8,.95);overflow-y:auto">
    <div style="padding:20px;max-width:360px;margin:0 auto">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:36px;margin-bottom:8px">🪖</div>
        <div style="font-size:22px;font-weight:900;color:var(--olive3)">BENAM 1.0</div>
        <div style="font-size:11px;color:var(--muted2)">Battlefield Emergency Network &amp; Aid Manager</div>
      </div>
      <div id="tutorial-steps">
        <div class="tut-step">
          <div class="tut-num">1</div>
          <div class="tut-content">
            <div class="tut-title">🛠 הכנה</div>
            <div class="tut-text">הזן תדרים, הוסף לוחמים, ולחץ ⚡ כדי להתחיל</div>
          </div>
        </div>
        <div class="tut-step">
          <div class="tut-num">2</div>
          <div class="tut-content">
            <div class="tut-title">⚔ ניהול (War Room)</div>
            <div class="tut-text">הוסף פגועים, סווג טריאז', נהל טיפולים</div>
          </div>
        </div>
        <div class="tut-step">
          <div class="tut-num">3</div>
          <div class="tut-content">
            <div class="tut-title">🔥 Fire Mode</div>
            <div class="tut-text">בחר פגוע → לחץ MARCH → ה-AI ממליץ הכל</div>
          </div>
        </div>
        <div class="tut-step">
          <div class="tut-num">4</div>
          <div class="tut-content">
            <div class="tut-title">📡 דוח</div>
            <div class="tut-text">צור 9-LINE, QR פינוי, ניהול דם ומלאי</div>
          </div>
        </div>
        <div class="tut-step">
          <div class="tut-num">5</div>
          <div class="tut-content">
            <div class="tut-title">📊 תחקיר</div>
            <div class="tut-text">ציון ביצועים, Gantt, Timeline, AAR</div>
          </div>
        </div>
      </div>
      <div style="text-align:center;margin-top:20px">
        <button class="btn btn-lg btn-olive btn-full" onclick="closeTutorial()"
          style="border-radius:10px;font-size:16px">🚀 יאללה — מתחילים!</button>
        <label
          style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;font-size:10px;color:var(--muted);cursor:pointer">
          <input type="checkbox" id="tut-no-show" style="width:14px;height:14px"> אל תציג שוב
        </label>
      </div>
    </div>
  </div>
`;

export function mountOverlayTemplateRoot() {
  const root = document.getElementById('overlay-template-root');
  if (!root || root.dataset.mounted === 'true') {
    return;
  }

  root.innerHTML = OVERLAY_TEMPLATE_HTML;
  root.dataset.mounted = 'true';
}

export function initOverlayTemplateComponent() {
  mountOverlayTemplateRoot();
}
