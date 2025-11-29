(function() {
  'use strict';
  
  console.log('🟢 شروع افزونه');
  
  var contextValid = true;
  
  function checkContext() {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        return true;
      }
      contextValid = false;
      return false;
    } catch (e) {
      contextValid = false;
      return false;
    }
  }
  
  // تست اولیه
  if (!checkContext()) {
    console.error('❌ Context نامعتبر است - لطفاً صفحه را رفرش کنید');
    return;
  }
  
  var portalContainer = document.createElement('div');
  portalContainer.id = 'highlighter-portal';
  portalContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;';
  
  function addPortal() {
    if (document.body && !document.getElementById('highlighter-portal')) {
      document.body.appendChild(portalContainer);
    }
  }
  
  if (document.body) {
    addPortal();
  } else {
    document.addEventListener('DOMContentLoaded', addPortal);
  }
  
  var style = document.createElement('style');
  style.textContent = '.highlighter-btn{position:fixed!important;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)!important;color:white!important;border:3px solid white!important;padding:12px 24px!important;border-radius:30px!important;cursor:pointer!important;font-family:Tahoma,Arial,sans-serif!important;font-size:16px!important;font-weight:bold!important;box-shadow:0 8px 25px rgba(102,126,234,0.6)!important;pointer-events:auto!important;z-index:2147483647!important;animation:highlighter-bounce 0.3s!important;user-select:none!important}.highlighter-btn:hover{transform:scale(1.1)!important;box-shadow:0 12px 35px rgba(102,126,234,0.8)!important}@keyframes highlighter-bounce{0%{transform:scale(0);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}.highlighter-mark{background-color:#FFFF00!important;padding:2px 4px!important;border-radius:3px!important;cursor:help!important;transition:all 0.2s!important;position:relative!important}.highlighter-mark:hover{background-color:#FFD700!important;box-shadow:0 0 10px rgba(255,215,0,0.5)!important}.highlighter-mark::after{content:attr(data-highlight-title);position:absolute;bottom:100%;left:50%;transform:translateX(-50%) translateY(-5px);background:rgba(0,0,0,0.9);color:white;padding:5px 10px;border-radius:5px;font-size:12px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity 0.2s;z-index:999999}.highlighter-mark:hover::after{opacity:1}';
  document.head.appendChild(style);
  
  var currentButton = null;
  var savedSelection = null;
  
  function removeButton() {
    if (currentButton && currentButton.parentNode) {
      currentButton.parentNode.removeChild(currentButton);
    }
    currentButton = null;
  }
  
  function showInvalidContextAlert() {
    alert('⚠️ افزونه به‌روزرسانی شده است!\n\n' +
          '🔄 لطفاً صفحه را رفرش کنید (F5) تا افزونه دوباره فعال شود.\n\n' +
          '💡 دلیل: وقتی افزونه را Reload می‌کنید، باید صفحات باز را هم رفرش کنید.');
    
    // غیرفعال کردن همه رویدادها
    contextValid = false;
  }
  
  function restoreHighlights() {
    if (!checkContext()) {
      console.warn('⚠️ Context نامعتبر - بازیابی لغو شد');
      return;
    }
    
    try {
      chrome.storage.local.get(['highlights'], function(result) {
        if (!checkContext() || chrome.runtime.lastError) {
          console.error('خطا در بازیابی');
          return;
        }
        
        var allHighlights = result.highlights || [];
        var url = window.location.href;
        var pageHighlights = [];
        
        for (var i = 0; i < allHighlights.length; i++) {
          if (allHighlights[i].url === url) {
            pageHighlights.push(allHighlights[i]);
          }
        }
        
        console.log('📦 بازیابی ' + pageHighlights.length + ' هایلایت');
        
        for (var j = 0; j < pageHighlights.length; j++) {
          setTimeout(restoreSingle, j * 50, pageHighlights[j]);
        }
      });
    } catch (e) {
      console.error('خطا در restoreHighlights:', e);
      contextValid = false;
    }
  }
  
  function restoreSingle(highlight) {
    var found = findText(highlight.text);
    if (!found) return;
    
    var span = document.createElement('span');
    span.className = 'highlighter-mark';
    span.style.backgroundColor = highlight.color || '#FFFF00';
    span.setAttribute('data-highlight-id', highlight.id);
    span.setAttribute('data-highlight-title', highlight.title);
    
    try {
      found.surroundContents(span);
      span.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        if (confirm('حذف هایلایت "' + highlight.title + '"؟')) {
          removeHighlight(highlight.id, span);
        }
      });
      console.log('✅ بازیابی: ' + highlight.title);
    } catch (e) {
      console.warn('⚠️ خطا در اعمال');
    }
  }
  
  function findText(text) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node;
    
    while (node = walker.nextNode()) {
      if (!node.parentElement) continue;
      
      var tag = node.parentElement.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
      if (node.parentElement.classList.contains('highlighter-mark')) continue;
      
      var index = node.textContent.indexOf(text);
      if (index !== -1) {
        var range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        return range;
      }
    }
    return null;
  }
  
  document.addEventListener('mouseup', function(e) {
    setTimeout(function() {
      if (!contextValid) return;
      
      var selection = window.getSelection();
      var text = selection.toString().trim();
      
      removeButton();
      
      if (text.length > 3) {
        try {
          var range = selection.getRangeAt(0);
          var parent = range.commonAncestorContainer;
          if (parent.nodeType === Node.TEXT_NODE) {
            parent = parent.parentElement;
          }
          
          if (parent.closest('.highlighter-mark')) {
            return;
          }
          
          savedSelection = {
            range: range.cloneRange(),
            text: text
          };
          
          addPortal();
          
          var btn = document.createElement('button');
          btn.className = 'highlighter-btn';
          btn.innerHTML = '📌 هایلایت کن';
          btn.style.top = (e.clientY + 15) + 'px';
          btn.style.left = e.clientX + 'px';
          
          portalContainer.appendChild(btn);
          currentButton = btn;
          
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            highlightText();
          });
          
          setTimeout(removeButton, 8000);
        } catch (err) {
          console.error('خطا در mouseup:', err);
        }
      }
    }, 10);
  });
  
  document.addEventListener('mousedown', function(e) {
    if (currentButton && !currentButton.contains(e.target)) {
      removeButton();
    }
  });
  
  function highlightText() {
    if (!checkContext()) {
      showInvalidContextAlert();
      removeButton();
      return;
    }
    
    var title = prompt('🎨 عنوان هایلایت:', 'نکته مهم');
    
    if (title && savedSelection) {
      var colors = ['#FFFF99', '#99FF99', '#FFB6C1', '#87CEEB', '#DDA0DD', '#F0E68C', '#FFE4B5', '#B0E0E6'];
      var color = colors[Math.floor(Math.random() * colors.length)];
      var id = Date.now();
      
      try {
        var span = document.createElement('span');
        span.className = 'highlighter-mark';
        span.style.backgroundColor = color;
        span.setAttribute('data-highlight-id', id);
        span.setAttribute('data-highlight-title', title);
        
        savedSelection.range.surroundContents(span);
        
        var data = {
          id: id,
          title: title,
          text: savedSelection.text,
          color: color,
          url: window.location.href,
          date: new Date().toISOString()
        };
        
        saveHighlight(data, span, title);
        
        span.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          if (confirm('حذف هایلایت "' + title + '"؟')) {
            removeHighlight(id, span);
          }
        });
      } catch (err) {
        console.error('خطا در هایلایت:', err);
        alert('❌ خطا! لطفاً دوباره تلاش کنید.');
      }
    }
    
    removeButton();
    window.getSelection().removeAllRanges();
    savedSelection = null;
  }
  
  function saveHighlight(data, span, title) {
    if (!checkContext()) {
      console.error('❌ Context نامعتبر');
      showInvalidContextAlert();
      
      // حذف span از DOM چون ذخیره نشد
      if (span && span.parentNode) {
        var text = span.textContent || '';
        var textNode = document.createTextNode(text);
        span.parentNode.replaceChild(textNode, span);
      }
      return;
    }
    
    try {
      chrome.storage.local.get(['highlights'], function(result) {
        if (!checkContext()) {
          console.error('❌ Context در حین get نامعتبر شد');
          showInvalidContextAlert();
          
          // حذف span از DOM
          if (span && span.parentNode) {
            var text = span.textContent || '';
            var textNode = document.createTextNode(text);
            span.parentNode.replaceChild(textNode, span);
          }
          return;
        }
        
        if (chrome.runtime.lastError) {
          console.error('خطا در get:', chrome.runtime.lastError);
          alert('❌ خطا در ذخیره!');
          return;
        }
        
        var highlights = result.highlights || [];
        highlights.push(data);
        
        chrome.storage.local.set({ highlights: highlights }, function() {
          if (!checkContext()) {
            console.error('❌ Context در حین set نامعتبر شد');
            return;
          }
          
          if (chrome.runtime.lastError) {
            console.error('خطا در set:', chrome.runtime.lastError);
            alert('❌ خطا در ذخیره!');
            return;
          }
          
          console.log('💾 ذخیره شد:', title);
          showMessage(title);
        });
      });
    } catch (err) {
      console.error('❌ خطا در ذخیره:', err);
      contextValid = false;
      showInvalidContextAlert();
      
      // حذف span از DOM
      if (span && span.parentNode) {
        var text = span.textContent || '';
        var textNode = document.createTextNode(text);
        span.parentNode.replaceChild(textNode, span);
      }
    }
  }
  
  function removeHighlight(id, span) {
    console.log('🗑️ حذف:', id);
    
    if (span && span.parentNode) {
      try {
        var text = span.textContent || '';
        var textNode = document.createTextNode(text);
        var parent = span.parentNode;
        parent.replaceChild(textNode, span);
        parent.normalize();
        console.log('✅ از DOM حذف شد');
      } catch (e) {
        console.error('خطا در حذف از DOM:', e);
      }
    }
    
    if (!checkContext()) {
      console.error('❌ Context نامعتبر - نمی‌توان از storage حذف کرد');
      showInvalidContextAlert();
      return;
    }
    
    try {
      chrome.storage.local.get(['highlights'], function(result) {
        if (!checkContext() || chrome.runtime.lastError) {
          console.error('خطا در حذف');
          return;
        }
        
        var highlights = result.highlights || [];
        var filtered = [];
        
        for (var i = 0; i < highlights.length; i++) {
          if (highlights[i].id !== id) {
            filtered.push(highlights[i]);
          }
        }
        
        chrome.storage.local.set({ highlights: filtered }, function() {
          if (!checkContext() || chrome.runtime.lastError) {
            console.error('خطا در حذف');
            return;
          }
          
          console.log('✅ از storage حذف شد');
          showMessage('هایلایت حذف شد', '#f44336');
        });
      });
    } catch (err) {
      console.error('خطا در removeHighlight:', err);
      contextValid = false;
    }
  }
  
  function showMessage(text, color) {
    try {
      color = color || '#11998e';
      var msg = document.createElement('div');
      msg.innerHTML = '✅ ' + text;
      msg.style.cssText = 'position:fixed!important;top:20px!important;right:20px!important;background:' + color + '!important;color:white!important;padding:15px 25px!important;border-radius:10px!important;font-family:Tahoma!important;font-size:14px!important;font-weight:bold!important;z-index:2147483647!important;box-shadow:0 4px 15px rgba(0,0,0,0.3)!important;animation:highlighter-bounce 0.3s!important;';
      
      portalContainer.appendChild(msg);
      
      setTimeout(function() {
        if (msg && msg.parentNode) {
          msg.parentNode.removeChild(msg);
        }
      }, 2500);
    } catch (e) {
      console.error('خطا در showMessage:', e);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(restoreHighlights, 500);
    });
  } else {
    setTimeout(restoreHighlights, 500);
  }
  
  console.log('🟢 آماده است!');
})();