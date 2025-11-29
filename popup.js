console.log('🟢 [Popup] شروع');

// تعویض تب‌ها
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const tabName = tab.dataset.tab;
    document.getElementById('current-highlights').classList.remove('active');
    document.getElementById('all-highlights').classList.remove('active');
    document.getElementById('stats-view').classList.remove('active');
    
    if (tabName === 'current') {
      document.getElementById('current-highlights').classList.add('active');
      loadCurrentPageHighlights();
    } else if (tabName === 'all') {
      document.getElementById('all-highlights').classList.add('active');
      loadAllHighlights();
    } else if (tabName === 'stats') {
      document.getElementById('stats-view').classList.add('active');
      loadStats();
    }
  });
});

// بارگذاری هایلایت‌های صفحه فعلی
async function loadCurrentPageHighlights() {
  console.log('📂 [Popup] بارگذاری هایلایت‌های صفحه فعلی...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;
    
    console.log('🔗 [Popup] URL فعلی:', url);
    
    const result = await chrome.storage.local.get(['highlights']);
    const allHighlights = result.highlights || [];
    
    console.log('📦 [Popup] کل هایلایت‌ها:', allHighlights.length);
    
    // فیلتر کردن بر اساس URL
    const highlights = allHighlights.filter(h => h.url === url);
    
    // بروزرسانی شمارنده
    document.getElementById('current-count').textContent = highlights.length;
    
    console.log('✅ [Popup] هایلایت‌های این صفحه:', highlights.length);
    
    const container = document.getElementById('current-highlights');
    
    if (highlights.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 48px; margin-bottom: 15px;">📚</div>
          <p style="font-size: 15px; font-weight: bold;">هنوز هایلایتی در این صفحه ندارید</p>
          <p style="font-size: 12px; color: #999; margin-top: 10px;">
            متن مورد نظر را انتخاب کنید و دکمه "📌 هایلایت کن" را بزنید
          </p>
        </div>
      `;
      return;
    }
    
    // مرتب‌سازی بر اساس تاریخ (جدیدترین اول)
    highlights.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    container.innerHTML = `<div class="highlight-list">` + highlights.map((h, index) => {
      const globalIndex = allHighlights.findIndex(item => item.id === h.id);
      return `
        <div class="highlight-item" style="animation-delay: ${index * 0.05}s;">
          <div class="highlight-title">
            <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                         -webkit-background-clip: text; 
                         -webkit-text-fill-color: transparent;
                         font-weight: bold;">
              ${escapeHtml(h.title)}
            </span>
          </div>
          <div class="highlight-text" style="background: ${h.color || '#FFFF99'}; border-right: 4px solid #FFD700;">
            ${escapeHtml(h.text.length > 200 ? h.text.substring(0, 200) + '...' : h.text)}
          </div>
          <div class="highlight-meta">
            <span style="font-size: 11px;">
              📅 ${formatDate(h.date)}
            </span>
            <button class="delete-btn" data-index="${globalIndex}">
              🗑️ حذف
            </button>
          </div>
        </div>
      `;
    }).join('') + `</div>`;
    
    // افزودن event listener برای دکمه‌های حذف
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const index = parseInt(btn.dataset.index);
        await deleteHighlight(index);
        loadCurrentPageHighlights();
        updateAllCounts();
      });
    });
    
  } catch (err) {
    console.error('❌ [Popup] خطا در بارگذاری:', err);
    document.getElementById('current-highlights').innerHTML = `
      <div class="empty-state">
        <p style="color: #f44336;">❌ خطا در بارگذاری هایلایت‌ها</p>
        <p style="font-size: 11px;">${err.message}</p>
      </div>
    `;
  }
}

// بارگذاری همه هایلایت‌ها
async function loadAllHighlights() {
  console.log('📂 [Popup] بارگذاری همه هایلایت‌ها...');
  
  try {
    const result = await chrome.storage.local.get(['highlights']);
    const allHighlights = result.highlights || [];
    
    // بروزرسانی شمارنده
    document.getElementById('all-count').textContent = allHighlights.length;
    
    console.log('📦 [Popup] تعداد کل:', allHighlights.length);
    
    const container = document.getElementById('all-highlights');
    
    if (allHighlights.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 48px; margin-bottom: 15px;">📖</div>
          <p style="font-size: 15px; font-weight: bold;">هنوز هایلایتی ندارید</p>
          <p style="font-size: 12px; color: #999; margin-top: 10px;">
            شروع کنید به هایلایت کردن مطالب مهم!
          </p>
        </div>
      `;
      return;
    }
    
    // مرتب‌سازی بر اساس تاریخ
    const sorted = [...allHighlights].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // گروه‌بندی بر اساس URL
    const groupedByUrl = {};
    sorted.forEach(h => {
      if (!groupedByUrl[h.url]) {
        groupedByUrl[h.url] = [];
      }
      groupedByUrl[h.url].push(h);
    });
    
    let html = '<div class="highlight-list">';
    
    for (const [url, highlights] of Object.entries(groupedByUrl)) {
      let domain = 'نامشخص';
      try {
        domain = new URL(url).hostname.replace('www.', '');
      } catch (e) {
        domain = url.substring(0, 50);
      }
      
      html += `
        <div style="margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); 
                      padding: 12px 15px; 
                      border-radius: 8px 8px 0 0; 
                      border-right: 4px solid #667eea;
                      position: sticky;
                      top: 0;
                      z-index: 10;">
            <div style="font-weight: bold; color: #333; margin-bottom: 5px; font-size: 13px;">
              🌐 ${escapeHtml(domain)}
            </div>
            <div style="font-size: 11px; color: #666;">
              ${highlights.length} هایلایت
            </div>
          </div>
      `;
      
      highlights.forEach((h, index) => {
        const globalIndex = allHighlights.findIndex(item => item.id === h.id);
        html += `
          <div class="highlight-item" style="margin-top: 0; border-radius: 0; 
               ${index === highlights.length - 1 ? 'border-radius: 0 0 8px 8px;' : ''}
               animation-delay: ${index * 0.05}s;">
            <div class="highlight-title">${escapeHtml(h.title)}</div>
            <div class="highlight-text" style="background: ${h.color || '#FFFF99'};">
              ${escapeHtml(h.text.length > 150 ? h.text.substring(0, 150) + '...' : h.text)}
            </div>
            <div class="highlight-meta">
              <span style="font-size: 11px;">📅 ${formatDate(h.date)}</span>
              <button class="delete-btn" data-index="${globalIndex}">🗑️ حذف</button>
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // افزودن event listener برای حذف
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const index = parseInt(btn.dataset.index);
        await deleteHighlight(index);
        loadAllHighlights();
        updateAllCounts();
      });
    });
    
  } catch (err) {
    console.error('❌ [Popup] خطا:', err);
    document.getElementById('all-highlights').innerHTML = `
      <div class="empty-state">
        <p style="color: #f44336;">❌ خطا در بارگذاری</p>
      </div>
    `;
  }
}

// نمایش آمار
async function loadStats() {
  console.log('📊 [Popup] بارگذاری آمار...');
  
  try {
    const result = await chrome.storage.local.get(['highlights']);
    const allHighlights = result.highlights || [];
    
    const totalHighlights = allHighlights.length;
    
    // تعداد صفحات یونیک
    const uniqueUrls = new Set(allHighlights.map(h => h.url));
    const totalPages = uniqueUrls.size;
    
    // محاسبه میانگین
    const avgPerPage = totalPages > 0 ? (totalHighlights / totalPages).toFixed(1) : 0;
    
    // آخرین هایلایت
    const lastHighlight = allHighlights.length > 0 
      ? [...allHighlights].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
      : null;
    
    // محبوب‌ترین رنگ
    const colorCounts = {};
    allHighlights.forEach(h => {
      const color = h.color || '#FFFF99';
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    });
    const popularColor = Object.keys(colorCounts).length > 0
      ? Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b)
      : '#FFFF99';
    
    const container = document.getElementById('stats-view');
    container.innerHTML = `
      <div style="padding: 20px;">
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="font-size: 48px;">📊</div>
          <h3 style="margin: 10px 0; color: #667eea;">آمار هایلایت‌ها</h3>
        </div>
        
        <div class="stat-item" style="background: linear-gradient(135deg, #667eea22 0%, #764ba222 100%);">
          <span>📚 تعداد کل هایلایت‌ها:</span>
          <strong style="font-size: 24px; color: #667eea;">${totalHighlights}</strong>
        </div>
        
        <div class="stat-item">
          <span>🌐 تعداد صفحات:</span>
          <strong style="font-size: 20px; color: #764ba2;">${totalPages}</strong>
        </div>
        
        <div class="stat-item">
          <span>📈 میانگین در هر صفحه:</span>
          <strong style="font-size: 20px; color: #11998e;">${avgPerPage}</strong>
        </div>
        
        <div class="stat-item">
          <span>🎨 رنگ محبوب:</span>
          <strong style="display: inline-block; width: 40px; height: 20px; background: ${popularColor}; border: 2px solid #ddd; border-radius: 4px;"></strong>
        </div>
        
        ${lastHighlight ? `
          <div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; border-right: 4px solid #FFD700;">
            <div style="font-weight: bold; margin-bottom: 8px; color: #333;">
              ⭐ آخرین هایلایت:
            </div>
            <div style="font-size: 13px; color: #555; margin-bottom: 5px; font-weight: bold;">
              "${escapeHtml(lastHighlight.title)}"
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
              ${escapeHtml(lastHighlight.text.substring(0, 80))}${lastHighlight.text.length > 80 ? '...' : ''}
            </div>
            <div style="font-size: 11px; color: #999;">
              📅 ${formatDate(lastHighlight.date)}
            </div>
          </div>
        ` : ''}
        
        ${totalHighlights > 0 ? `
          <div style="margin-top: 25px; display: flex; gap: 10px;">
            <button id="export-btn" style="
              flex: 1;
              background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              cursor: pointer;
              font-family: Tahoma;
              font-weight: bold;
              font-size: 13px;
              transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
              📥 خروجی JSON
            </button>
            <button id="export-text-btn" style="
              flex: 1;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              cursor: pointer;
              font-family: Tahoma;
              font-weight: bold;
              font-size: 13px;
              transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
              📄 خروجی متنی
            </button>
          </div>
          <div style="margin-top: 10px;">
            <button id="clear-all-btn" style="
              width: 100%;
              background: #f44336;
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 8px;
              cursor: pointer;
              font-family: Tahoma;
              font-weight: bold;
              font-size: 13px;
              transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
              🗑️ پاک کردن همه
            </button>
          </div>
        ` : ''}
      </div>
    `;
    
    // دکمه خروجی JSON
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(allHighlights, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `highlights_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      });
    }
    
    // دکمه خروجی متنی
    const exportTextBtn = document.getElementById('export-text-btn');
    if (exportTextBtn) {
      exportTextBtn.addEventListener('click', () => {
        let text = '📌 هایلایت‌های من\n';
        text += '='.repeat(50) + '\n\n';
        
        const grouped = {};
        allHighlights.forEach(h => {
          if (!grouped[h.url]) grouped[h.url] = [];
          grouped[h.url].push(h);
        });
        
        for (const [url, highlights] of Object.entries(grouped)) {
          text += `🌐 ${url}\n`;
          text += '-'.repeat(50) + '\n';
          highlights.forEach((h, i) => {
            text += `\n${i + 1}. ${h.title}\n`;
            text += `   ${h.text}\n`;
            text += `   📅 ${formatDate(h.date)}\n`;
          });
          text += '\n' + '='.repeat(50) + '\n\n';
        }
        
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `highlights_${new Date().toISOString().split('T')[0]}.txt`;
        link.click();
        URL.revokeObjectURL(url);
      });
    }
    
    // دکمه پاک کردن همه
    const clearBtn = document.getElementById('clear-all-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm(`⚠️ آیا مطمئن هستید که می‌خواهید ${totalHighlights} هایلایت را پاک کنید؟\n\nاین عمل قابل بازگشت نیست!`)) {
          await chrome.storage.local.set({ highlights: [] });
          alert('✅ همه هایلایت‌ها پاک شدند!');
          loadStats();
          updateAllCounts();
        }
      });
    }
    
  } catch (err) {
    console.error('❌ [Popup] خطا در آمار:', err);
  }
}

// حذف هایلایت
async function deleteHighlight(index) {
  try {
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || [];
    
    if (index >= 0 && index < highlights.length) {
      const deleted = highlights[index];
      if (confirm(`حذف هایلایت "${deleted.title}"؟`)) {
        highlights.splice(index, 1);
        await chrome.storage.local.set({ highlights: highlights });
        console.log('🗑️ [Popup] هایلایت حذف شد');
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('❌ [Popup] خطا در حذف:', err);
    return false;
  }
}

// بروزرسانی همه شمارنده‌ها
async function updateAllCounts() {
  try {
    const result = await chrome.storage.local.get(['highlights']);
    const allHighlights = result.highlights || [];
    
    document.getElementById('all-count').textContent = allHighlights.length;
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;
    const currentHighlights = allHighlights.filter(h => h.url === url);
    document.getElementById('current-count').textContent = currentHighlights.length;
  } catch (err) {
    console.error('❌ خطا در بروزرسانی شمارنده‌ها:', err);
  }
}

// فرمت تاریخ
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'همین الان';
    if (minutes < 60) return `${minutes} دقیقه پیش`;
    if (hours < 24) return `${hours} ساعت پیش`;
    if (days < 7) return `${days} روز پیش`;
    
    return date.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'تاریخ نامشخص';
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// بارگذاری اولیه
loadCurrentPageHighlights();
updateAllCounts();

console.log('✅ [Popup] آماده است');