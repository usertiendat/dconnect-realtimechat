// ============================================================
// D-CONNECT Client - Socket.IO (WebSocket tren TCP) & MongoDB Sync
// ============================================================

(function () {
  // Trạng thái cục bộ của Client
  let myClient = {
    clientId: null,
    displayName: 'Khách',
    avatarColor: 'linear-gradient(135deg, #0E7490, #06B6D4)'
  };

  let currentRoom = {
    roomId: null,
    name: 'Đang kết nối...',
    type: 'public',
    code: null
  };

  let allUsers = [];
  let isInitialConnect = true;
  let hasMoreHistory = false;
  let nextHistoryCursor = null;
  let isLoadingHistory = false;
  let lastReceivedMessageAt = null;

  // Tập hợp các ID tin nhắn đã render để chống trùng lặp (Deduplication)
  const renderedMessageIds = new Set();

  // Khởi tạo Socket.IO
  const socket = io({
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000
  });

  // DOM Elements
  const $messages = document.getElementById('messages');
  const $userList = document.getElementById('userList');
  const $onlineCount = document.getElementById('onlineCount');
  const $sidebarCount = document.getElementById('sidebarCount');
  const $myName = document.getElementById('myName');
  const $headerAvatar = document.getElementById('headerAvatar');
  const $msgInput = document.getElementById('msgInput');
  const $sendBtn = document.getElementById('sendBtn');
  const $searchInput = document.getElementById('searchInput');

  const $roomNameDisplay = document.getElementById('roomNameDisplay');
  const $roomIcon = document.getElementById('roomIcon');
  const $privateCodeBadge = document.getElementById('privateCodeBadge');
  const $roomCodeText = document.getElementById('roomCodeText');
  const $copyCodeBtn = document.getElementById('copyCodeBtn');

  const $loadMoreContainer = document.getElementById('loadMoreContainer');
  const $loadMoreBtn = document.getElementById('loadMoreBtn');
  const $loadMoreSpinner = document.getElementById('loadMoreSpinner');

  const $renameBtn = document.getElementById('renameBtn');
  const $renameModal = document.getElementById('renameModal');
  const $cancelRenameBtn = document.getElementById('cancelRenameBtn');
  const $saveRenameBtn = document.getElementById('saveRenameBtn');
  const $newUsernameInput = document.getElementById('newUsernameInput');
  const $renameError = document.getElementById('renameError');

  const $switchRoomBtn = document.getElementById('switchRoomBtn');
  const $roomModal = document.getElementById('roomModal');
  const $closeRoomModalBtn = document.getElementById('closeRoomModalBtn');
  const $tabPublic = document.getElementById('tabPublic');
  const $tabCreate = document.getElementById('tabCreate');
  const $tabJoin = document.getElementById('tabJoin');
  const $tabContentPublic = document.getElementById('tabContentPublic');
  const $tabContentCreate = document.getElementById('tabContentCreate');
  const $tabContentJoin = document.getElementById('tabContentJoin');
  const $modalJoinPublicBtn = document.getElementById('modalJoinPublicBtn');
  const $modalCreatePrivateBtn = document.getElementById('modalCreatePrivateBtn');
  const $customRoomNameInput = document.getElementById('customRoomNameInput');
  const $modalRoomCodeInput = document.getElementById('modalRoomCodeInput');
  const $modalJoinPrivateBtn = document.getElementById('modalJoinPrivateBtn');
  const $modalCodeError = document.getElementById('modalCodeError');
  const $leaveBtn = document.getElementById('leaveBtn');

  // Typing indicator state
  const typingUsers = new Map(); // Map<senderId, { username, timeout }>
  const $typing = document.getElementById('typingIndicator');
  let amITyping = false;
  let stopTimer = null;
  let heartbeatTimer = null;
  let lastTypingEmitAt = 0;
  const TYPING_IDLE_MS = 1800;
  const TYPING_EXPIRE_MS = 4500;
  const TYPING_HEARTBEAT_MS = 2000;

  // -------------------------------------------------------------
  // TOAST NOTIFICATION UTILITY
  // -------------------------------------------------------------
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function scrollToBottom() {
    $messages.scrollTop = $messages.scrollHeight;
  }

  // -------------------------------------------------------------
  // RENDER MESSAGES
  // -------------------------------------------------------------
  function addSystemMessage(text, time) {
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.textContent = `${text} • ${time || ''}`;
    $messages.appendChild(div);
    scrollToBottom();
  }

  function createMessageElement(msg) {
    const isMine = msg.senderId === myClient.clientId;
    const row = document.createElement('div');
    row.className = 'msg-row ' + (isMine ? 'mine' : 'theirs');
    row.dataset.msgId = msg.messageId;

    if (!isMine) {
      const av = document.createElement('div');
      av.className = 'avatar';
      av.style.background = msg.avatarColor || 'linear-gradient(135deg, #0E7490, #06B6D4)';
      av.textContent = (msg.senderName || '?').charAt(0).toUpperCase();
      row.appendChild(av);
    }

    const body = document.createElement('div');
    body.innerHTML =
      (!isMine ? `<div class="sender-name">${escapeHtml(msg.senderName)}</div>` : '') +
      `<div class="bubble">${escapeHtml(msg.text)}</div>` +
      `<div class="msg-meta">${escapeHtml(msg.time || '')}</div>`;
    row.appendChild(body);
    return row;
  }

  function appendChatMessage(msg) {
    if (!msg || !msg.messageId) return;
    if (renderedMessageIds.has(msg.messageId)) return; // Khử trùng lặp

    renderedMessageIds.add(msg.messageId);
    if (msg.createdAt) {
      lastReceivedMessageAt = msg.createdAt;
    }

    const el = createMessageElement(msg);
    $messages.appendChild(el);
    scrollToBottom();
  }

  function prependHistoryMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return;

    // Lưu lại chiều cao hiện tại để giữ vị trí cuộn mượt mà
    const oldScrollHeight = $messages.scrollHeight;
    const oldScrollTop = $messages.scrollTop;

    const fragment = document.createDocumentFragment();
    messages.forEach((msg) => {
      if (!renderedMessageIds.has(msg.messageId)) {
        renderedMessageIds.add(msg.messageId);
        const el = createMessageElement(msg);
        fragment.appendChild(el);
      }
    });

    $messages.insertBefore(fragment, $messages.firstChild);

    // Điều chỉnh scroll để người dùng không bị giật trang khi tin cũ tải xong
    $messages.scrollTop = oldScrollTop + ($messages.scrollHeight - oldScrollHeight);
  }

  // -------------------------------------------------------------
  // USER LIST & STATUS
  // -------------------------------------------------------------
  function renderUserList(filter = '') {
    $userList.innerHTML = '';
    const q = filter.trim().toLowerCase();
    const shown = allUsers.filter((u) => (u.displayName || '').toLowerCase().includes(q));

    $onlineCount.textContent = `● ${allUsers.length} online`;
    $sidebarCount.textContent = allUsers.length;

    shown.forEach((u) => {
      const li = document.createElement('li');
      const av = document.createElement('div');
      av.className = 'avatar';
      av.style.background = u.avatarColor || 'linear-gradient(135deg, #0E7490, #06B6D4)';
      av.textContent = (u.displayName || '?').charAt(0).toUpperCase();

      const span = document.createElement('span');
      span.textContent = u.displayName + (u.clientId === myClient.clientId ? ' (bạn)' : '');

      li.appendChild(av);
      li.appendChild(span);
      $userList.appendChild(li);
    });
  }

  function updateRoomHeader(room) {
    currentRoom = room;
    $roomNameDisplay.textContent = room.name || 'Phòng chat';

    if (room.type === 'private') {
      $roomIcon.textContent = '🔒';
      $privateCodeBadge.style.display = 'inline-flex';
      $roomCodeText.textContent = room.code || '------';
    } else {
      $roomIcon.textContent = '🌐';
      $privateCodeBadge.style.display = 'none';
    }
  }

  function updateClientIdentity(client) {
    myClient = { ...myClient, ...client };
    $myName.textContent = myClient.displayName;
    $headerAvatar.textContent = myClient.displayName.charAt(0).toUpperCase();
    $headerAvatar.style.background = myClient.avatarColor;
  }

  // -------------------------------------------------------------
  // TYPING INDICATOR
  // -------------------------------------------------------------
  function renderTyping() {
    if (!$typing) return;
    const names = [...typingUsers.values()].map((t) => t.username);
    if (names.length === 0) {
      $typing.classList.remove('show');
      $typing.innerHTML = '';
      return;
    }
    let text;
    if (names.length === 1) text = `${names[0]} đang nhập`;
    else if (names.length === 2) text = `${names[0]} và ${names[1]} đang nhập`;
    else text = `${names.length} người đang nhập`;

    $typing.classList.add('show');
    $typing.innerHTML = `<span>${escapeHtml(text)}</span><span class="typing-dots"><span></span><span></span><span></span></span>`;
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      if ($msgInput.value.trim() !== '') {
        amITyping = true;
        lastTypingEmitAt = Date.now();
        socket.emit('typing-start');
      }
    }, TYPING_HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function emitTypingStart() {
    const now = Date.now();
    if (amITyping && now - lastTypingEmitAt < TYPING_HEARTBEAT_MS) return;
    amITyping = true;
    lastTypingEmitAt = now;
    socket.emit('typing-start');
    startHeartbeat();
  }

  function emitTypingStop() {
    if (!amITyping && !heartbeatTimer) return;
    amITyping = false;
    stopHeartbeat();
    socket.emit('typing-stop');
  }

  // -------------------------------------------------------------
  // GỬI TIN NHẮN (VỚI ACKNOWLEDGEMENT)
  // -------------------------------------------------------------
  function sendMessage() {
    const text = $msgInput.value.trim();
    if (!text) return;

    emitTypingStop();
    if (stopTimer) clearTimeout(stopTimer);

    const clientTempId = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    // Gửi tin kèm callback acknowledgement
    socket.emit('send-message', { text, clientTempId }, (ack) => {
      if (!ack || !ack.success) {
        showToast(ack && ack.error ? ack.error : 'Không thể gửi tin nhắn.', 'error');
      }
    });

    $msgInput.value = '';
    $msgInput.focus();
  }

  // -------------------------------------------------------------
  // TẢI LỊCH SỬ TIN NHẮN (PHÂN TRANG CURSOR-BASED)
  // -------------------------------------------------------------
  function loadOlderHistory() {
    if (!hasMoreHistory || isLoadingHistory || !nextHistoryCursor) return;

    isLoadingHistory = true;
    $loadMoreSpinner.style.display = 'inline-block';
    $loadMoreBtn.disabled = true;

    socket.emit(
      'get-history',
      { roomId: currentRoom.roomId, before: nextHistoryCursor, limit: 30 },
      (res) => {
        isLoadingHistory = false;
        $loadMoreSpinner.style.display = 'none';
        $loadMoreBtn.disabled = false;

        if (res && res.success) {
          prependHistoryMessages(res.messages);
          hasMoreHistory = res.hasMore;
          nextHistoryCursor = res.nextCursor;

          $loadMoreContainer.style.display = hasMoreHistory ? 'block' : 'none';
        } else {
          showToast('Lỗi khi tải tin nhắn cũ hơn.', 'error');
        }
      }
    );
  }

  // -------------------------------------------------------------
  // SOCKET.IO EVENT LISTENERS
  // -------------------------------------------------------------
  socket.on('connect', () => {
    console.log('[Socket] Connected ID:', socket.id);

    if (isInitialConnect) {
      isInitialConnect = false;

      // Xử lý đổi tên chờ sẵn nếu có từ index.html
      const pendingRename = sessionStorage.getItem('dconnect_pending_rename');
      if (pendingRename) {
        sessionStorage.removeItem('dconnect_pending_rename');
        socket.emit('rename-client', { newName: pendingRename }, (res) => {
          if (res && res.success) {
            updateClientIdentity({ displayName: res.newName });
            showToast(`Đã đổi tên thành: ${res.newName}`, 'success');
          }
        });
      }

      // Kiểm tra hành động tham gia phòng từ landing page hoặc khôi phục phòng khi F5 (Reload)
      const action = sessionStorage.getItem('dconnect_action');
      const customRoomName = sessionStorage.getItem('dconnect_custom_room_name');
      const targetCode = sessionStorage.getItem('dconnect_target_code');
      const activeRoomId = sessionStorage.getItem('dconnect_active_room_id');
      const activeRoomCode = sessionStorage.getItem('dconnect_active_room_code');

      if (action === 'create_private') {
        // Chỉ tạo phòng 1 lần khi người dùng vừa bấm nút tạo từ index hoặc modal
        sessionStorage.removeItem('dconnect_action');
        sessionStorage.removeItem('dconnect_custom_room_name');
        socket.emit('create-room', { customName: customRoomName }, (res) => {
          if (res && res.success) {
            handleJoinSuccess(res.room, { messages: [], hasMore: false });
            showToast(`Đã tạo phòng: ${res.room.name} (${res.room.code})`, 'success');
          } else {
            showToast(res && res.error ? res.error : 'Không thể tạo phòng riêng.', 'error');
            joinPublicRoom();
          }
        });
      } else if (action === 'join_private' && targetCode) {
        sessionStorage.removeItem('dconnect_action');
        sessionStorage.removeItem('dconnect_target_code');
        socket.emit('join-room', { code: targetCode }, (res) => {
          if (res && res.success) {
            handleJoinSuccess(res.room, res.history);
          } else {
            showToast(res && res.error ? res.error : 'Mã phòng không tồn tại.', 'error');
            joinPublicRoom();
          }
        });
      } else if (activeRoomId && activeRoomId !== 'general') {
        // Khôi phục phòng riêng khi F5 (Reload trang)
        socket.emit('join-room', { roomId: activeRoomId, code: activeRoomCode }, (res) => {
          if (res && res.success) {
            handleJoinSuccess(res.room, res.history);
          } else {
            showToast('Phòng riêng không còn tồn tại hoặc đã đóng.', 'info');
            joinPublicRoom();
          }
        });
      } else {
        joinPublicRoom();
      }
    } else {
      // Khi Reconnect: Đồng bộ tin nhắn bị bỏ lỡ
      showToast('Đã kết nối lại! Đang đồng bộ...', 'info');
      if (currentRoom.roomId) {
        socket.emit(
          'sync-state',
          { roomId: currentRoom.roomId, lastMessageAt: lastReceivedMessageAt },
          (res) => {
            if (res && res.success) {
              if (res.missedMessages && res.missedMessages.length > 0) {
                res.missedMessages.forEach(appendChatMessage);
                showToast(`Đã nhận ${res.missedMessages.length} tin nhắn mới`, 'success');
              }
              if (res.userList) {
                allUsers = res.userList;
                renderUserList($searchInput.value);
              }
            }
          }
        );
      }
    }
  });

  socket.on('session-info', (client) => {
    updateClientIdentity(client);
  });

  socket.on('receive-message', (msg) => {
    appendChatMessage(msg);
  });

  socket.on('user-joined', (d) => {
    addSystemMessage(d.message, d.time);
  });

  socket.on('user-left', (d) => {
    addSystemMessage(d.message, d.time);
    typingUsers.delete(d.senderId || d.username);
    renderTyping();
  });

  socket.on('user-renamed', (d) => {
    addSystemMessage(d.message, d.time);
  });

  socket.on('update-user-list', (list) => {
    allUsers = list;
    renderUserList($searchInput.value);
  });

  socket.on('user-typing', (d) => {
    if (!d || d.senderId === myClient.clientId) return;
    if (typingUsers.has(d.senderId)) clearTimeout(typingUsers.get(d.senderId).timeout);
    const timeout = setTimeout(() => {
      typingUsers.delete(d.senderId);
      renderTyping();
    }, TYPING_EXPIRE_MS);
    typingUsers.set(d.senderId, { username: d.username, timeout });
    renderTyping();
  });

  socket.on('user-stop-typing', (d) => {
    if (!d) return;
    const t = typingUsers.get(d.senderId);
    if (t) clearTimeout(t.timeout);
    typingUsers.delete(d.senderId);
    renderTyping();
  });

  socket.on('disconnect', (reason) => {
    showToast('Mất kết nối server. Đang tự động kết nối lại...', 'error');
  });

  // -------------------------------------------------------------
  // ROOM JOIN HANDLERS
  // -------------------------------------------------------------
  function handleJoinSuccess(room, history) {
    updateRoomHeader(room);
    $messages.innerHTML = '';
    renderedMessageIds.clear();

    // Lưu lại phòng hiện tại để F5 không bao giờ bị mất phòng!
    sessionStorage.setItem('dconnect_active_room_id', room.roomId);
    sessionStorage.setItem('dconnect_active_room_type', room.type);
    if (room.code) {
      sessionStorage.setItem('dconnect_active_room_code', room.code);
    } else {
      sessionStorage.removeItem('dconnect_active_room_code');
    }
    // Xóa sạch cờ hành động tạm thời
    sessionStorage.removeItem('dconnect_action');
    sessionStorage.removeItem('dconnect_target_code');
    sessionStorage.removeItem('dconnect_custom_room_name');

    if (history && Array.isArray(history.messages)) {
      history.messages.forEach(appendChatMessage);
      hasMoreHistory = history.hasMore;
      nextHistoryCursor = history.nextCursor;
      $loadMoreContainer.style.display = hasMoreHistory ? 'block' : 'none';
    }

    addSystemMessage(`Bạn đã tham gia ${room.name}`);
  }

  function joinPublicRoom() {
    sessionStorage.setItem('dconnect_active_room_id', 'general');
    sessionStorage.setItem('dconnect_active_room_type', 'public');
    sessionStorage.removeItem('dconnect_active_room_code');
    sessionStorage.removeItem('dconnect_action');
    sessionStorage.removeItem('dconnect_target_code');
    sessionStorage.removeItem('dconnect_custom_room_name');

    socket.emit('join-room', { roomId: 'general' }, (res) => {
      if (res && res.success) {
        handleJoinSuccess(res.room, res.history);
      } else {
        showToast(res && res.error ? res.error : 'Không thể vào phòng chung.', 'error');
      }
    });
  }

  // -------------------------------------------------------------
  // UI EVENT LISTENERS
  // -------------------------------------------------------------
  $sendBtn.addEventListener('click', sendMessage);
  $msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  $msgInput.addEventListener('input', () => {
    if ($msgInput.value.trim() !== '') {
      emitTypingStart();
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = setTimeout(emitTypingStop, TYPING_IDLE_MS);
    } else {
      if (stopTimer) clearTimeout(stopTimer);
      emitTypingStop();
    }
  });

  $searchInput.addEventListener('input', () => renderUserList($searchInput.value));
  $loadMoreBtn.addEventListener('click', loadOlderHistory);

  // Sao chép mã phòng
  $copyCodeBtn.addEventListener('click', () => {
    if (!currentRoom.code) return;
    navigator.clipboard.writeText(currentRoom.code).then(() => {
      showToast(`Đã sao chép mã phòng: ${currentRoom.code}`, 'success');
    }).catch(() => {
      showToast(`Mã phòng: ${currentRoom.code}`, 'info');
    });
  });

  // Modal Đổi tên
  $renameBtn.addEventListener('click', () => {
    $newUsernameInput.value = myClient.displayName || '';
    $renameError.textContent = '';
    $renameModal.classList.add('active');
    $newUsernameInput.focus();
  });

  $cancelRenameBtn.addEventListener('click', () => {
    $renameModal.classList.remove('active');
  });

  $saveRenameBtn.addEventListener('click', () => {
    const newName = $newUsernameInput.value.trim();
    if (newName.length < 2 || newName.length > 20) {
      $renameError.textContent = 'Tên phải từ 2 đến 20 ký tự.';
      return;
    }

    socket.emit('rename-client', { newName }, (res) => {
      if (res && res.success) {
        updateClientIdentity({ displayName: res.newName });
        $renameModal.classList.remove('active');
        showToast(`Đã đổi tên thành: ${res.newName}`, 'success');
      } else {
        $renameError.textContent = res && res.error ? res.error : 'Không thể đổi tên.';
      }
    });
  });

  // Modal Đổi phòng
  $switchRoomBtn.addEventListener('click', () => {
    $roomModal.classList.add('active');
  });

  $closeRoomModalBtn.addEventListener('click', () => {
    $roomModal.classList.remove('active');
  });

  // Tabs
  $tabPublic.addEventListener('click', () => {
    setActiveTab('public');
  });
  $tabCreate.addEventListener('click', () => {
    setActiveTab('create');
  });
  $tabJoin.addEventListener('click', () => {
    setActiveTab('join');
  });

  function setActiveTab(tab) {
    [$tabPublic, $tabCreate, $tabJoin].forEach((b) => b.classList.remove('active'));
    [$tabContentPublic, $tabContentCreate, $tabContentJoin].forEach((p) => p.classList.remove('active'));

    if (tab === 'public') {
      $tabPublic.classList.add('active');
      $tabContentPublic.classList.add('active');
    } else if (tab === 'create') {
      $tabCreate.classList.add('active');
      $tabContentCreate.classList.add('active');
    } else if (tab === 'join') {
      $tabJoin.classList.add('active');
      $tabContentJoin.classList.add('active');
    }
  }

  $modalJoinPublicBtn.addEventListener('click', () => {
    $roomModal.classList.remove('active');
    joinPublicRoom();
  });

  $modalCreatePrivateBtn.addEventListener('click', () => {
    const customName = $customRoomNameInput.value.trim();
    socket.emit('create-room', { customName }, (res) => {
      $roomModal.classList.remove('active');
      if (res && res.success) {
        handleJoinSuccess(res.room, { messages: [], hasMore: false });
        showToast(`Đã tạo phòng riêng: ${res.room.code}`, 'success');
      } else {
        showToast(res && res.error ? res.error : 'Lỗi tạo phòng.', 'error');
      }
    });
  });

  $modalJoinPrivateBtn.addEventListener('click', () => {
    const code = $modalRoomCodeInput.value.trim().toUpperCase();
    if (code.length !== 6) {
      $modalCodeError.textContent = 'Mã phòng phải gồm đúng 6 ký tự.';
      return;
    }
    $modalCodeError.textContent = '';
    socket.emit('join-room', { code }, (res) => {
      if (res && res.success) {
        $roomModal.classList.remove('active');
        handleJoinSuccess(res.room, res.history);
      } else {
        $modalCodeError.textContent = res && res.error ? res.error : 'Mã phòng không hợp lệ.';
      }
    });
  });

  $leaveBtn.addEventListener('click', () => {
    sessionStorage.removeItem('dconnect_active_room_id');
    sessionStorage.removeItem('dconnect_active_room_code');
    sessionStorage.removeItem('dconnect_active_room_type');
    sessionStorage.removeItem('dconnect_action');
    sessionStorage.removeItem('dconnect_target_code');
    sessionStorage.removeItem('dconnect_custom_room_name');
    socket.emit('leave-room', () => {
      window.location.href = 'index.html';
    });
  });

  // Focus ô gõ tin
  $msgInput.focus();
})();
