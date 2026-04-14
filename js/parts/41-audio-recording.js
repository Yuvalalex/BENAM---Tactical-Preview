// ═══════════════════════════════════════════════════
// 🎙️ AUDIO RECORDING SYSTEM (CASUALTY REPORT)
// ═══════════════════════════════════════════════════

let _globalRecorder = null;
let _globalAudioChunks = [];
let _recordingCasId = null;
let _recordingStartMs = 0;
let _recordingTimer = null;

function toggleAudioRecord(casId) {
  const c = S.casualties.find(x => x.id == casId);
  if (!c) return;

  if (_globalRecorder && _globalRecorder.state === 'recording') {
    // Stop recording
    if (_recordingCasId === casId) {
      _globalRecorder.stop();
      return;
    } else {
      showToast('הקלטה פעילה בפצוע אחר'); return;
    }
  }

  // Request Microphone access
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('❌ הדפדפן לא תומך בהקלטת אודיו');
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      _globalAudioChunks = [];
      _recordingCasId = casId;
      _globalRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      _globalRecorder.ondataavailable = e => {
        if (e.data.size > 0) _globalAudioChunks.push(e.data);
      };
      
      _globalRecorder.onstart = () => {
        _recordingStartMs = Date.now();
        showToast('🎙️ מקליט דוח מילולי...');
        if(navigator.vibrate) navigator.vibrate(50);
        updateRecordingUI(casId, true);
        
        _recordingTimer = setInterval(() => {
           const sec = Math.floor((Date.now() - _recordingStartMs) / 1000);
           const m = Math.floor(sec / 60);
           const s = String(sec % 60).padStart(2, '0');
           const btn = document.getElementById(`btn-rec-${casId}`);
           if (btn) {
             btn.innerHTML = `<span style="color:var(--red3)">⏹ ${m}:${s}</span>`;
           }
        }, 1000);
      };

      _globalRecorder.onstop = () => {
        clearInterval(_recordingTimer);
        const audioBlob = new Blob(_globalAudioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = function() {
          const base64data = reader.result;
          const targetCas = S.casualties.find(x => x.id == _recordingCasId);
          if (targetCas) {
            targetCas.voiceRecords = targetCas.voiceRecords || [];
            targetCas.voiceRecords.push({ ms: Date.now(), data: base64data });
            addTL(_recordingCasId, targetCas.name, '🎙️ הוקלט דוח קולי', 'amber');
            saveState();
            showToast('✓ הדוח נשמר בהצלחה');
          }
          _recordingCasId = null;
          updateRecordingUI(casId, false);
          
          // Stop all mic tracks
          stream.getTracks().forEach(track => track.stop());
        }
        reader.readAsDataURL(audioBlob);
      };

      _globalRecorder.start();
    })
    .catch(err => {
      console.error('Audio Record error:', err);
      showToast('❌ אין הרשאה למיקרופון');
    });
}

function updateRecordingUI(casId, isRecording) {
  const btn = document.getElementById(`btn-rec-${casId}`);
  if (btn) {
    if (isRecording) {
      btn.style.borderColor = 'var(--red3)';
      btn.innerHTML = `<span style="color:var(--red3)">⏹ הולט...</span>`;
    } else {
      btn.style.borderColor = 'transparent';
      btn.innerHTML = `🎙️ הקלט דוח`;
    }
  }
}
