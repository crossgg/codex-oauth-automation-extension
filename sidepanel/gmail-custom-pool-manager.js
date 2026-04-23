(function attachSidepanelGmailCustomPoolManager(globalScope) {
  function createGmailCustomPoolManager(context = {}) {
    const {
      state,
      dom,
      helpers,
      runtime,
      constants = {},
      gmailCustomPoolUtils = {},
    } = context;

    const expandedStorageKey = constants.expandedStorageKey || 'multipage-gmail-custom-pool-list-expanded';
    const copyIcon = constants.copyIcon || '';
    const createAccountPoolFormController = globalScope.SidepanelAccountPoolUi?.createAccountPoolFormController;

    let actionInFlight = false;
    let listExpanded = false;

    function getAccounts(currentState = state.getLatestState()) {
      return helpers.getGmailCustomPoolAccounts(currentState);
    }

    function getAccountsByUsage(mode = 'all', currentState = state.getLatestState()) {
      if (typeof gmailCustomPoolUtils.filterGmailCustomPoolAccountsByUsage === 'function') {
        return gmailCustomPoolUtils.filterGmailCustomPoolAccountsByUsage(getAccounts(currentState), mode);
      }
      return getAccounts(currentState);
    }

    function getCurrentAccountId(currentState = state.getLatestState()) {
      return String(currentState?.currentGmailCustomPoolAccountId || '').trim();
    }

    function getBulkActionText(mode, count) {
      if (typeof gmailCustomPoolUtils.getGmailCustomPoolBulkActionLabel === 'function') {
        return gmailCustomPoolUtils.getGmailCustomPoolBulkActionLabel(mode, count);
      }
      return mode === 'used' ? '清空已用' : '全部删除';
    }

    function getListToggleText(expanded, count) {
      if (typeof gmailCustomPoolUtils.getGmailCustomPoolListToggleLabel === 'function') {
        return gmailCustomPoolUtils.getGmailCustomPoolListToggleLabel(expanded, count);
      }
      return expanded ? '收起列表' : '展开列表';
    }

    function shouldClearCurrentSelection(account) {
      if (typeof gmailCustomPoolUtils.shouldClearGmailCustomPoolCurrentSelection === 'function') {
        return gmailCustomPoolUtils.shouldClearGmailCustomPoolCurrentSelection(account);
      }
      return Boolean(account?.used);
    }

    function updateViewport() {
      const count = getAccounts().length;
      const usedCount = getAccountsByUsage('used').length;

      if (dom.btnClearUsedGmailCustomPoolAccounts) {
        dom.btnClearUsedGmailCustomPoolAccounts.textContent = getBulkActionText('used', usedCount);
        dom.btnClearUsedGmailCustomPoolAccounts.disabled = usedCount === 0;
      }
      if (dom.btnDeleteAllGmailCustomPoolAccounts) {
        dom.btnDeleteAllGmailCustomPoolAccounts.textContent = getBulkActionText('all', count);
        dom.btnDeleteAllGmailCustomPoolAccounts.disabled = count === 0;
      }
      if (dom.btnToggleGmailCustomPoolList) {
        dom.btnToggleGmailCustomPoolList.textContent = getListToggleText(listExpanded, count);
        dom.btnToggleGmailCustomPoolList.disabled = count === 0;
        dom.btnToggleGmailCustomPoolList.setAttribute('aria-expanded', String(listExpanded));
      }
      if (dom.gmailCustomPoolListShell) {
        dom.gmailCustomPoolListShell.classList.toggle('is-expanded', listExpanded);
        dom.gmailCustomPoolListShell.classList.toggle('is-collapsed', !listExpanded);
      }
    }

    function setListExpanded(expanded, options = {}) {
      const { persist = true } = options;
      listExpanded = Boolean(expanded);
      updateViewport();
      if (persist) {
        localStorage.setItem(expandedStorageKey, listExpanded ? '1' : '0');
      }
    }

    function initListExpandedState() {
      const saved = localStorage.getItem(expandedStorageKey);
      setListExpanded(saved === '1', { persist: false });
    }

    function clearForm() {
      if (dom.inputGmailCustomPoolEmail) {
        dom.inputGmailCustomPoolEmail.value = '';
      }
    }

    const formController = typeof createAccountPoolFormController === 'function'
      ? createAccountPoolFormController({
        formShell: dom.gmailCustomPoolFormShell,
        toggleButton: dom.btnToggleGmailCustomPoolForm,
        hiddenLabel: '添加邮箱',
        visibleLabel: '取消添加',
        onClear: clearForm,
        onFocus: () => {
          dom.inputGmailCustomPoolEmail?.focus?.();
        },
      })
      : {
        isVisible: () => false,
        setVisible() {},
        sync() {},
      };

    function refreshSelectionUi() {
      renderAccounts();
      if (helpers.shouldSyncRegistrationEmail?.()) {
        dom.inputEmail.value = helpers.getCurrentGmailCustomPoolEmail();
      }
    }

    function applyAccountMutation(account) {
      if (!account?.id) {
        return;
      }

      const latestState = state.getLatestState();
      const nextAccounts = typeof gmailCustomPoolUtils.upsertGmailCustomPoolAccountInList === 'function'
        ? gmailCustomPoolUtils.upsertGmailCustomPoolAccountInList(getAccounts(latestState), account)
        : getAccounts(latestState).map((item) => (item.id === account.id ? account : item));

      const nextState = {
        gmailCustomPoolAccounts: nextAccounts,
      };
      if (
        latestState?.currentGmailCustomPoolAccountId === account.id
        && shouldClearCurrentSelection(account)
      ) {
        nextState.currentGmailCustomPoolAccountId = '';
      }

      state.syncLatestState(nextState);
      refreshSelectionUi();
    }

    function renderAccounts() {
      if (!dom.gmailCustomPoolAccountsList) {
        return;
      }

      const accounts = getAccounts();
      const currentId = getCurrentAccountId();
      if (!accounts.length) {
        dom.gmailCustomPoolAccountsList.innerHTML = '<div class="hotmail-empty">还没有导入 Gmail 自定义号池邮箱，先添加一条再使用。</div>';
        updateViewport();
        return;
      }

      dom.gmailCustomPoolAccountsList.innerHTML = accounts.map((account) => `
        <div class="hotmail-account-item${account.id === currentId ? ' is-current' : ''}">
          <div class="hotmail-account-top">
            <div class="hotmail-account-title-row">
              <div class="hotmail-account-email">${helpers.escapeHtml(account.email || '(未命名邮箱)')}</div>
              <button
                class="hotmail-copy-btn"
                type="button"
                data-account-action="copy-email"
                data-account-id="${helpers.escapeHtml(account.id)}"
                title="复制邮箱"
                aria-label="复制邮箱 ${helpers.escapeHtml(account.email || '')}"
              >${copyIcon}</button>
            </div>
            <span class="hotmail-status-chip ${account.used ? 'status-used' : 'status-authorized'}">${account.used ? '已用' : '可用'}</span>
          </div>
          <div class="hotmail-account-meta">
            <span>状态: ${helpers.escapeHtml(account.used ? '已使用' : '未使用')}</span>
            <span>上次使用: ${helpers.escapeHtml(helpers.formatGmailCustomPoolDateTime(account.lastUsedAt))}</span>
          </div>
          <div class="hotmail-account-actions">
            <button class="btn btn-outline btn-sm" type="button" data-account-action="select" data-account-id="${helpers.escapeHtml(account.id)}">使用此账号</button>
            <button class="btn btn-outline btn-sm" type="button" data-account-action="toggle-used" data-account-id="${helpers.escapeHtml(account.id)}">${account.used ? '标记未用' : '标记已用'}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-account-action="delete" data-account-id="${helpers.escapeHtml(account.id)}">删除</button>
          </div>
        </div>
      `).join('');

      updateViewport();
    }

    async function handleAddAccount() {
      if (actionInFlight) {
        return;
      }

      const email = String(dom.inputGmailCustomPoolEmail?.value || '').trim();
      if (!email) {
        helpers.showToast('请先填写邮箱地址。', 'warn');
        return;
      }

      actionInFlight = true;
      if (dom.btnAddGmailCustomPoolAccount) {
        dom.btnAddGmailCustomPoolAccount.disabled = true;
      }

      try {
        const response = await runtime.sendMessage({
          type: 'UPSERT_GMAIL_CUSTOM_POOL_ACCOUNT',
          source: 'sidepanel',
          payload: { email },
        });
        if (response?.error) {
          throw new Error(response.error);
        }

        applyAccountMutation(response.account);
        formController.setVisible(false, { clearForm: true });
        helpers.showToast(`已保存邮箱 ${response.account.email}`, 'success', 1800);
      } catch (err) {
        helpers.showToast(`保存 Gmail 自定义号池邮箱失败：${err.message}`, 'error');
      } finally {
        actionInFlight = false;
        if (dom.btnAddGmailCustomPoolAccount) {
          dom.btnAddGmailCustomPoolAccount.disabled = false;
        }
      }
    }

    async function handleImportAccounts() {
      if (actionInFlight) {
        return;
      }
      if (typeof gmailCustomPoolUtils.parseGmailCustomPoolImportText !== 'function') {
        helpers.showToast('Gmail 自定义号池导入解析器未加载，请刷新扩展后重试。', 'error');
        return;
      }

      const rawText = String(dom.inputGmailCustomPoolImport?.value || '').trim();
      if (!rawText) {
        helpers.showToast('请先粘贴批量导入内容。', 'warn');
        return;
      }

      const accounts = gmailCustomPoolUtils.parseGmailCustomPoolImportText(rawText);
      if (!accounts.length) {
        helpers.showToast('没有解析到有效邮箱，请按“一行一个完整邮箱”导入。', 'error');
        return;
      }

      actionInFlight = true;
      if (dom.btnImportGmailCustomPoolAccounts) {
        dom.btnImportGmailCustomPoolAccounts.disabled = true;
      }

      try {
        for (const account of accounts) {
          const response = await runtime.sendMessage({
            type: 'UPSERT_GMAIL_CUSTOM_POOL_ACCOUNT',
            source: 'sidepanel',
            payload: account,
          });
          if (response?.error) {
            throw new Error(response.error);
          }
        }

        if (dom.inputGmailCustomPoolImport) {
          dom.inputGmailCustomPoolImport.value = '';
        }
        helpers.showToast(`已导入 ${accounts.length} 个邮箱`, 'success', 2200);
      } catch (err) {
        helpers.showToast(`批量导入失败：${err.message}`, 'error');
      } finally {
        actionInFlight = false;
        if (dom.btnImportGmailCustomPoolAccounts) {
          dom.btnImportGmailCustomPoolAccounts.disabled = false;
        }
      }
    }

    async function deleteAccountsByMode(mode) {
      const targetAccounts = getAccountsByUsage(mode === 'used' ? 'used' : 'all');
      if (!targetAccounts.length) {
        helpers.showToast(mode === 'used' ? '没有已用邮箱可清空。' : '没有可删除的邮箱。', 'warn');
        return;
      }

      const confirmed = await helpers.openConfirmModal({
        title: mode === 'used' ? '清空已用邮箱' : '全部删除邮箱',
        message: mode === 'used'
          ? `确认删除当前 ${targetAccounts.length} 个已用邮箱吗？`
          : `确认删除当前全部 ${targetAccounts.length} 个 Gmail 自定义号池邮箱吗？`,
        confirmLabel: mode === 'used' ? '确认清空已用' : '确认全部删除',
        confirmVariant: mode === 'used' ? 'btn-outline' : 'btn-danger',
      });
      if (!confirmed) {
        return;
      }

      const response = await runtime.sendMessage({
        type: 'DELETE_GMAIL_CUSTOM_POOL_ACCOUNTS',
        source: 'sidepanel',
        payload: { mode },
      });
      if (response?.error) {
        throw new Error(response.error);
      }

      const latestState = state.getLatestState();
      const targetIds = new Set(targetAccounts.map((account) => account.id));
      const nextState = {
        gmailCustomPoolAccounts: mode === 'used'
          ? getAccounts().filter((account) => !targetIds.has(account.id))
          : [],
      };
      if (latestState?.currentGmailCustomPoolAccountId && targetIds.has(latestState.currentGmailCustomPoolAccountId)) {
        nextState.currentGmailCustomPoolAccountId = '';
      }
      state.syncLatestState(nextState);
      refreshSelectionUi();

      helpers.showToast(
        mode === 'used'
          ? `已清空 ${response.deletedCount || 0} 个已用邮箱`
          : `已删除全部 ${response.deletedCount || 0} 个邮箱`,
        'success',
        2200
      );
    }

    async function handleAccountListClick(event) {
      const actionButton = event.target.closest('[data-account-action]');
      if (!actionButton || actionInFlight) {
        return;
      }

      const accountId = String(actionButton.dataset.accountId || '').trim();
      const action = String(actionButton.dataset.accountAction || '').trim();
      if (!accountId || !action) {
        return;
      }

      const targetAccount = getAccounts().find((account) => account.id === accountId) || null;
      actionInFlight = true;
      actionButton.disabled = true;

      try {
        if (action === 'copy-email') {
          if (!targetAccount?.email) {
            throw new Error('未找到可复制的邮箱地址。');
          }
          await helpers.copyTextToClipboard(targetAccount.email);
          helpers.showToast(`已复制 ${targetAccount.email}`, 'success', 1800);
          return;
        }

        if (action === 'select') {
          const response = await runtime.sendMessage({
            type: 'SELECT_GMAIL_CUSTOM_POOL_ACCOUNT',
            source: 'sidepanel',
            payload: { accountId },
          });
          if (response?.error) {
            throw new Error(response.error);
          }
          state.syncLatestState({ currentGmailCustomPoolAccountId: response.account.id });
          refreshSelectionUi();
          helpers.showToast(`已切换当前邮箱为 ${response.account.email}`, 'success', 1800);
          return;
        }

        if (action === 'toggle-used') {
          if (!targetAccount) {
            throw new Error('未找到目标邮箱。');
          }
          const response = await runtime.sendMessage({
            type: 'PATCH_GMAIL_CUSTOM_POOL_ACCOUNT',
            source: 'sidepanel',
            payload: {
              accountId,
              updates: {
                used: !targetAccount.used,
              },
            },
          });
          if (response?.error) {
            throw new Error(response.error);
          }
          applyAccountMutation(response.account);
          helpers.showToast(
            `${response.account.email} 已${response.account.used ? '标记为已用' : '恢复为未用'}`,
            'success',
            2200
          );
          return;
        }

        if (action === 'delete') {
          const confirmed = await helpers.openConfirmModal({
            title: '删除邮箱',
            message: '确认删除这个 Gmail 自定义号池邮箱吗？',
            confirmLabel: '确认删除',
            confirmVariant: 'btn-danger',
          });
          if (!confirmed) {
            return;
          }

          const response = await runtime.sendMessage({
            type: 'DELETE_GMAIL_CUSTOM_POOL_ACCOUNT',
            source: 'sidepanel',
            payload: { accountId },
          });
          if (response?.error) {
            throw new Error(response.error);
          }

          const nextState = {
            gmailCustomPoolAccounts: getAccounts().filter((account) => account.id !== accountId),
          };
          if (getCurrentAccountId() === accountId) {
            nextState.currentGmailCustomPoolAccountId = '';
          }
          state.syncLatestState(nextState);
          refreshSelectionUi();
          helpers.showToast('邮箱已删除', 'success', 1800);
        }
      } catch (err) {
        helpers.showToast(err.message, 'error');
      } finally {
        actionInFlight = false;
        actionButton.disabled = false;
      }
    }

    function bindGmailCustomPoolEvents() {
      dom.btnToggleGmailCustomPoolList?.addEventListener('click', () => {
        setListExpanded(!listExpanded);
      });

      dom.btnToggleGmailCustomPoolForm?.addEventListener('click', () => {
        if (formController.isVisible()) {
          formController.setVisible(false, { clearForm: true });
          return;
        }
        formController.setVisible(true, { focusField: true });
      });

      dom.btnAddGmailCustomPoolAccount?.addEventListener('click', handleAddAccount);
      dom.btnImportGmailCustomPoolAccounts?.addEventListener('click', handleImportAccounts);
      dom.btnClearUsedGmailCustomPoolAccounts?.addEventListener('click', async () => {
        if (actionInFlight) return;
        actionInFlight = true;
        try {
          await deleteAccountsByMode('used');
        } catch (err) {
          helpers.showToast(err.message, 'error');
        } finally {
          actionInFlight = false;
          updateViewport();
        }
      });
      dom.btnDeleteAllGmailCustomPoolAccounts?.addEventListener('click', async () => {
        if (actionInFlight) return;
        actionInFlight = true;
        try {
          await deleteAccountsByMode('all');
        } catch (err) {
          helpers.showToast(err.message, 'error');
        } finally {
          actionInFlight = false;
          updateViewport();
        }
      });
      dom.gmailCustomPoolAccountsList?.addEventListener('click', handleAccountListClick);
      formController.sync();
    }

    return {
      bindGmailCustomPoolEvents,
      initGmailCustomPoolListExpandedState: initListExpandedState,
      renderGmailCustomPoolAccounts: renderAccounts,
    };
  }

  globalScope.SidepanelGmailCustomPoolManager = {
    createGmailCustomPoolManager,
  };
})(window);
