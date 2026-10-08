/* Standalone back-office prototype. Never reads or mutates the mini-program state. */
(() => {
  'use strict';
  const DEMO_DATE = '2026-09-22';
  const categories = {industrial:'工业润滑油',automotive:'车用润滑油'};
  const products = {
    'oem-hm68':{name:'抗磨液压油 L-HM 68（高清高压）白色 马石油',category:'industrial',weightKg:16},
    'oem-hm46':{name:'抗磨液压油 L-HM 46（高清高压）白色 马石油',category:'industrial',weightKg:16},
    'brand-hm46':{name:'腾原智造 抗磨液压油 L-HM 46（高压）170kg/桶',category:'industrial',weightKg:170},
    'brand-dah46':{name:'腾原智造 优选·经典 空气压缩机油 L-DAH 46 170kg/桶',category:'industrial',weightKg:170}
  };
  const scopeTypes = {all:'全部产品',category:'产品分类',product:'指定产品'};
  const targetTypes = ['销售经理','销售经理主管','销售总监'];
  const salespeople = {
    'sales-001':{name:'张明（示例）',type:'销售经理'},
    'sales-002':{name:'李华（示例）',type:'销售经理'},
    'supervisor-001':{name:'王强（示例）',type:'销售经理主管'},
    'supervisor-002':{name:'陈静（示例）',type:'销售经理主管'},
    'director-001':{name:'刘伟（示例）',type:'销售总监'},
    'director-002':{name:'赵敏（示例）',type:'销售总监'}
  };
  const modes = {percent:'按百分比',fixed:'固定金额'};
  const initial = [
    {id:'SQ-001',name:'销售经理通用让利',types:['销售经理'],sales:[],scopeType:'category',scopes:['industrial','automotive'],mode:'percent',value:2,unit:'吨',cap:20000,start:'2026-09-20',end:'2026-12-31',enabled:true,creator:'运营（示例）',remark:'适用于销售经理类型下的所有人员，不与其他规则叠加。'},
    {id:'SQ-002',name:'销售经理液压油临时让利',types:['销售经理'],sales:[],scopeType:'product',scopes:['oem-hm46'],mode:'percent',value:3,unit:'吨',cap:30000,start:'2026-09-20',end:'2026-09-27',enabled:true,creator:'运营（示例）',remark:'适用于指定液压油产品的临时让利。'},
    {id:'SQ-003',name:'销售总监工业油让利',types:['销售总监'],sales:[],scopeType:'category',scopes:['industrial'],mode:'fixed',value:4,unit:'吨',cap:null,start:'2026-09-20',end:'2026-12-31',enabled:true,creator:'运营（示例）',remark:'适用于销售总监；所选产品分类按元/吨固定金额让利。'},
    {id:'SQ-004',name:'销售经理主管产品让利',types:['销售经理主管'],sales:[],scopeType:'product',scopes:['brand-hm46'],mode:'fixed',value:6.04,unit:'吨',cap:null,start:'2026-09-20',end:'2026-12-31',enabled:false,creator:'运营（示例）',remark:'适用于销售经理主管；按元/吨配置，桶装按净重换算。'}
  ];
  const adminState = {rules:structuredClone(initial),operator:'运营',editing:null,toggling:null,nextId:5,nextLogId:1,filters:{search:'',type:'',status:''},logs:[]};
  const root = document.getElementById('admin');
  const q = id => document.getElementById(id);
  const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => '¥'+Number(value).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const option = (value,label=value) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const stateOf = r => r.enabled?'启用':'停用';
  const scopeOptions = kind => kind==='all'?{}:kind==='category'?categories:Object.fromEntries(Object.entries(products).map(([id,p])=>[id,p.name]));
  const scopeName = r => r.scopeType==='all'?'全部产品':r.scopes.map(id=>scopeOptions(r.scopeType)[id]||id).join('、');
  const typeName = r => r.types.join('、');
  const salesName = r => r.sales.length?r.sales.map(id=>salespeople[id]?.name||id).join('、'):'全部销售';
  const audienceName = r => `${typeName(r)}－${salesName(r)}`;
  const ruleValue = r => r.mode==='percent'?`${r.value}%`: `${money(r.value)}/${r.unit}`;
  const canView = types => Array.isArray(types)&&types.length>0&&types.every(type=>targetTypes.includes(type));
  const canManage = canView;
  const permissionError = '请选择有效的适用职级。';
  let toastTimer;
  function toast(message) {q('paToast').textContent=message;q('paToast').classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>q('paToast').classList.remove('is-visible'),3200);}

  root.innerHTML = `
    <div class="pa-heading"><h1>销售折扣管理</h1><button type="button" class="pa-btn pa-requirements-button" id="paRequirements" aria-haspopup="dialog" aria-controls="paRequirementsDialog">需求说明</button></div>
    <div class="pa-workbench">
      <div class="pa-section-title">折扣规则</div>
      <div id="paRulesPanel">
        <div class="pa-rules-actions"><button class="pa-btn pa-primary" id="paAdd">＋ 新增规则</button></div>
        <form id="paFilters" class="pa-filters"><label class="pa-search">规则名称<input id="paSearch" type="search" placeholder="请输入规则名称" /></label><label>适用职级<select id="paTypeFilter">${option('','全部职级')}${targetTypes.map(t=>option(t)).join('')}</select></label><label>状态<select id="paStatusFilter">${option('','全部状态')}${['启用','停用'].map(v=>option(v)).join('')}</select></label><button class="pa-btn pa-primary" type="submit">查询</button><button class="pa-btn" type="reset">重置</button></form>
        <div class="pa-table-scroll" tabindex="0" aria-label="折扣规则列表，可横向滚动"><table class="pa-table pa-rules-table"><thead><tr><th scope="col">规则名称</th><th scope="col">适用对象</th><th scope="col">适用范围</th><th scope="col">让利方式</th><th scope="col">让利值</th><th scope="col">单笔让利上限</th><th scope="col">有效期</th><th scope="col">状态</th><th scope="col">创建人</th><th scope="col">备注</th><th scope="col">操作</th></tr></thead><tbody id="paRows"></tbody></table></div>
        <div class="pa-table-foot"><span id="paFilterCount"></span></div>
      </div>
    </div>
    `;

  // Remove the obsolete admin-only drawer; all mini-program markup is untouched.
  q('drawerBackdrop')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="paEditor" class="pa-dialog" aria-labelledby="paEditorTitle"><form id="paEditorForm">
      <header><div><h2 id="paEditorTitle">新增折扣规则</h2></div><button type="button" class="pa-icon-button" data-pa-close aria-label="关闭折扣规则编辑">×</button></header>
      <div class="pa-editor-body">
        <fieldset><legend>01 适用对象与产品范围</legend><div class="pa-form-grid">
          <label class="pa-full">规则名称 *<input id="paRuleName" required maxlength="60" placeholder="如：销售经理通用让利" /></label>
          <div class="pa-select-field"><div id="paTargetTypesLabel" class="pa-field-label">适用职级 *</div><details id="paTargetTypesPicker" class="pa-scope-select"><summary aria-labelledby="paTargetTypesLabel paTargetTypesValue"><span id="paTargetTypesValue" class="is-placeholder">请选择适用职级</span></summary><div id="paTargetTypes" class="pa-scope-options" role="group" aria-labelledby="paTargetTypesLabel"></div></details></div>
          <div class="pa-select-field"><div id="paSalesLabel" class="pa-field-label">指定销售人员（选填）</div><details id="paSalesPicker" class="pa-scope-select"><summary aria-labelledby="paSalesLabel paSalesValue" aria-describedby="paSalesHelp"><span id="paSalesValue">全部销售</span></summary><div id="paSales" class="pa-scope-options" role="group" aria-labelledby="paSalesLabel"></div></details><small id="paSalesHelp">可多选，不选则适用所选职级的全部销售。</small></div>
          <label>适用范围 *<select id="paScopeType" required><option value="all">全部产品</option><option value="category">产品分类</option><option value="product">指定产品</option></select></label>
          <div class="pa-select-field pa-scope-field"><div id="paScopesLabel" class="pa-scopes-label">适用产品分类 * <span>可多选</span></div><details id="paScopePicker" class="pa-scope-select"><summary aria-labelledby="paScopesLabel paScopesValue"><span id="paScopesValue">请选择适用产品分类</span></summary><div id="paScopes" class="pa-scope-options" role="group" aria-labelledby="paScopesLabel"></div></details></div>
        </div></fieldset>
        <fieldset><legend>02 让利规则</legend><div class="pa-form-grid">
          <label class="pa-full">让利方式 *<select id="paMode"><option value="percent">按百分比让利</option><option value="fixed">按固定金额让利（元/吨）</option></select></label>
          <label><span id="paValueLabel">让利值（%） *</span><input id="paValue" type="number" required min="0" max="99.99" step="0.01" value="2" /><small id="paValueHelp">填写2表示最多让利2%，不是打2折。</small></label>
          <label class="pa-full">单笔让利金额上限（元，选填）<input id="paCap" type="number" min="0.01" step="0.01" placeholder="不填写则不限制额外金额上限" /><small>汇总所选产品的让利金额；不计算优惠券抵扣。</small></label>
        </div></fieldset>
        <fieldset><legend>03 有效期与状态</legend><div class="pa-form-grid">
          <div class="pa-full pa-period-field"><div id="paPeriodLabel" class="pa-field-label">有效期 *</div><div class="pa-date-range" role="group" aria-labelledby="paPeriodLabel"><input id="paStart" type="date" required aria-label="开始日期" /><span>至</span><input id="paEnd" type="date" required aria-label="结束日期" /></div><small>请选择开始和结束日期，结束日期当天仍有效。</small></div>
          <label>状态 *<select id="paEnabled" required><option value="true">启用</option><option value="false">停用</option></select></label><label class="pa-full">备注（选填）<textarea id="paRemark" maxlength="300" placeholder="填写适用场景或授权依据"></textarea></label>
          <label id="paReasonField" class="pa-full" hidden>本次修改原因 *<textarea id="paReason" maxlength="300" placeholder="说明为什么调整规则，便于后续追溯"></textarea></label>
        </div></fieldset><div id="paFormError" class="pa-error" role="alert" hidden></div>
      </div><footer><button type="button" class="pa-btn" data-pa-close>取消</button><button type="submit" class="pa-btn pa-primary" id="paSave">保存规则</button></footer>
    </form></dialog>
    <dialog id="paConfirm" class="pa-dialog pa-confirm" aria-labelledby="paConfirmTitle"><form id="paConfirmForm"><header><h2 id="paConfirmTitle">停用折扣规则</h2><button type="button" class="pa-icon-button" id="paConfirmClose" aria-label="关闭确认">×</button></header><div class="pa-editor-body"><label>操作原因 *<textarea id="paToggleReason" required maxlength="300" placeholder="请填写原因"></textarea></label><p id="paConfirmText" class="pa-confirm-help"></p><div id="paToggleError" class="pa-error" role="alert" hidden></div></div><footer><button class="pa-btn" type="button" id="paConfirmCancel">取消</button><button class="pa-btn pa-primary" type="submit" id="paConfirmSave">确认</button></footer></form></dialog>
    <dialog id="paAuditDialog" class="pa-dialog" aria-labelledby="paAuditDialogTitle">
      <header><h2 id="paAuditDialogTitle">变更记录</h2><button type="button" class="pa-icon-button" data-pa-audit-close aria-label="关闭变更记录">×</button></header>
      <div class="pa-editor-body"><dl class="pa-audit-summary"><div><dt>规则名称</dt><dd id="paAuditRuleName"></dd></div><div><dt>适用对象</dt><dd id="paAuditRuleTypes"></dd></div></dl><div id="paAuditHistory"></div></div>
      <footer><button type="button" class="pa-btn pa-primary" data-pa-audit-close>关闭</button></footer>
    </dialog>
    <dialog id="paRequirementsDialog" class="pa-dialog" aria-labelledby="paRequirementsTitle">
      <header><h2 id="paRequirementsTitle">销售折扣管理—需求说明</h2><button type="button" class="pa-icon-button" data-pa-requirements-close aria-label="关闭需求说明">×</button></header>
      <div class="pa-editor-body pa-requirements-body">
        <section class="pa-requirement-section">
          <h3>一、功能目标</h3>
          <p>销售折扣管理用于配置不同销售职级或指定销售人员的自主让利规则。销售报价时，系统根据当前销售、产品及有效期匹配唯一一条折扣规则，计算“当前销售最低可报”。按销售折扣规则计算出的最低可报价，若低于商品成本价，则取商品成本价。规则之间不叠加，超出规则允许范围时阻止提交订单。</p>
        </section>
        <section class="pa-requirement-section">
          <h3>二、字段口径</h3>
          <table class="pa-requirements-table pa-field-definition-table"><thead><tr><th scope="col">字段</th><th scope="col">是否必填</th><th scope="col">说明</th></tr></thead><tbody>
            <tr><th scope="row">规则名称</th><td>是</td><td>手动填写，最多 60 个字符。</td></tr>
            <tr><th scope="row">适用职级</th><td>是</td><td>多选且至少选择一项：销售经理、销售经理主管或销售总监。</td></tr>
            <tr><th scope="row">指定销售人员</th><td>否</td><td>多选；选项根据适用职级联动。不选择时，适用所选职级全部销售。</td></tr>
            <tr><th scope="row">适用范围</th><td>是</td><td>单选：全部产品、产品分类或指定产品；默认全部产品。</td></tr>
            <tr><th scope="row">适用产品</th><td>是</td><td>选择产品分类或指定产品时多选且至少选择一项；选择全部产品时不显示。</td></tr>
            <tr><th scope="row">让利方式</th><td>是</td><td>单选：按百分比让利或按固定金额让利。</td></tr>
            <tr><th scope="row">让利值</th><td>是</td><td>填写非负数字，最多保留两位小数；百分比须小于 100，固定金额单位为元/吨。</td></tr>
            <tr><th scope="row">单笔让利上限</th><td>否</td><td>填写大于 0 的数字，最多保留两位小数，单位为元；留空表示不限制。</td></tr>
            <tr><th scope="row">有效期</th><td>是</td><td>选择开始日期和结束日期；结束日期不得早于开始日期，结束日期当天仍有效。</td></tr>
            <tr><th scope="row">状态</th><td>是</td><td>单选：启用或停用。</td></tr>
            <tr><th scope="row">备注</th><td>否</td><td>选填；可填写适用场景或授权依据，最多 300 个字符。</td></tr>
          </tbody></table>
        </section>
        <section class="pa-requirement-section">
          <h3>三、规则匹配优先级</h3>
          <p class="pa-requirement-emphasis">个人优先于职级，指定产品优先于产品分类，产品分类优先于全部产品；只取一条规则，不叠加。</p>
          <table class="pa-requirements-table pa-priority-table"><thead><tr><th scope="col">优先级</th><th scope="col">授权对象</th><th scope="col">适用范围</th></tr></thead><tbody>
            <tr><td>1</td><td>指定销售</td><td>指定产品</td></tr>
            <tr><td>2</td><td>指定销售</td><td>产品分类</td></tr>
            <tr><td>3</td><td>指定销售</td><td>全部产品</td></tr>
            <tr><td>4</td><td>销售职级</td><td>指定产品</td></tr>
            <tr><td>5</td><td>销售职级</td><td>产品分类</td></tr>
            <tr><td>6</td><td>销售职级</td><td>全部产品</td></tr>
            <tr><td>7</td><td>无匹配规则</td><td>不允许让利</td></tr>
          </tbody></table>
        </section>
        <section class="pa-requirement-section">
          <h3>四、冲突与兜底规则</h3>
          <ul>
            <li>同一授权对象、指定销售、适用范围及重叠有效期内，不允许存在两条相同优先级的启用规则。</li>
            <li>保存规则时发现同优先级冲突，系统应提示冲突规则并阻止保存，不按让利值大小自动选择。</li>
            <li>高优先级规则停用、未生效、已失效或不适用当前产品时，继续匹配下一优先级规则。</li>
            <li>多商品订单按商品逐行匹配折扣规则。</li>
          </ul>
        </section>
        <section class="pa-requirement-section">
          <h3>五、计算示例</h3>
          <div class="pa-example"><strong>示例 1：指定产品优先</strong><p>销售经理的产品分类规则为 2%，同职级的指定产品规则为 5%。该指定产品匹配 5%，同分类其他产品仍匹配 2%。</p></div>
          <div class="pa-example"><strong>示例 2：个人优先</strong><p>销售经理职级规则为 2%，指定销售张明的规则为 5%。张明匹配 5%，其他销售经理仍匹配 2%。</p></div>
        </section>
      </div>
      <footer><button type="button" class="pa-btn pa-primary" data-pa-requirements-close>关闭</button></footer>
    </dialog>
    <div id="paToast" role="status" aria-live="polite"></div>`);

  function renderRules() {
    const f=adminState.filters;
    const filtered=adminState.rules.filter(r=>canView(r.types)&&(!f.search||r.name.toLowerCase().includes(f.search.toLowerCase()))&&(!f.type||r.types.includes(f.type))&&(!f.status||(f.status==='启用'?r.enabled:!r.enabled)));
    q('paRows').innerHTML=filtered.map(r=>{
      const status=stateOf(r), tone=r.enabled?'live':'';
      return `<tr><td><strong>${esc(r.name)}</strong></td><td class="pa-audience-cell">${esc(audienceName(r))}</td><td>${esc(scopeName(r))}${r.scopeType==='all'?'':`<small>${esc(scopeTypes[r.scopeType])}</small>`}</td><td>${esc(modes[r.mode])}</td><td><strong>${ruleValue(r)}</strong></td><td>${r.cap===null?'不限':money(r.cap)}</td><td class="pa-validity">${esc(r.start)} 至 ${esc(r.end)}</td><td><span class="pa-pill ${tone}">${status}</span></td><td class="pa-creator">${esc(r.creator||'—')}</td><td class="pa-remark">${esc(r.remark||"—")}</td><td><div class="pa-actions">${!canManage(r.types)?'<span class="pa-readonly">只读</span>':r.legacy?`<button class="pa-link muted" data-pa-legacy="${r.id}">查看说明</button>`:`<button class="pa-link" data-pa-edit="${r.id}" aria-label="编辑${esc(r.name)}">编辑</button><button class="pa-link" data-pa-toggle="${r.id}" aria-label="${r.enabled?'停用':'启用'}${esc(r.name)}">${r.enabled?'停用':'启用'}</button>`}<button type="button" class="pa-link" data-pa-audit-open="${r.id}" aria-haspopup="dialog" aria-controls="paAuditDialog" aria-label="查看${esc(r.name)}的变更记录">变更记录</button></div></td></tr>`;
    }).join('')||'<tr><td colspan="11" class="pa-empty">没有符合条件的规则，试试调整筛选条件。</td></tr>';
    q('paFilterCount').textContent=`共 ${filtered.length} 条`;
  }
  function selectedScopes() {return [...q('paScopes').querySelectorAll('input:checked')].map(el=>el.value);}
  function renderScopeOptions(selected=[]) {
    const kind=q('paScopeType').value;
    const field=q('paScopes').closest('.pa-scope-field');
    field.hidden=kind==='all';
    if(kind==='all'){q('paScopes').replaceChildren();syncScopePicker();return;}
    q('paScopesLabel').innerHTML=(kind==='category'?'适用产品分类':'适用产品')+' * <span>可多选</span>';
    q('paScopes').innerHTML=Object.entries(scopeOptions(kind)).map(([value,label])=>`<label class="pa-scope-option"><input type="checkbox" name="scopes" value="${esc(value)}" ${selected.includes(value)?'checked':''}/><span>${esc(label)}</span></label>`).join('');
    syncScopePicker();
  }
  function selectedSales() {return [...q('paSales').querySelectorAll('input:checked')].map(el=>el.value);}
  function selectedTargetTypes() {return [...q('paTargetTypes').querySelectorAll('input:checked')].map(el=>el.value);}
  function renderTargetTypeOptions(selected=[]) {
    q('paTargetTypes').innerHTML=targetTypes.map(type=>`<label class="pa-scope-option"><input type="checkbox" name="targetTypes" value="${esc(type)}" ${selected.includes(type)?'checked':''}/><span>${esc(type)}</span></label>`).join('');
    syncTargetTypesPicker();
  }
  function syncTargetTypesPicker() {
    const selected=selectedTargetTypes(),label=selected.length?selected.join('、'):'请选择适用职级';
    q('paTargetTypesValue').textContent=label;q('paTargetTypesValue').title=label;q('paTargetTypesValue').classList.toggle('is-placeholder',!selected.length);
  }
  function renderSalesOptions(selected=[]) {
    const types=selectedTargetTypes();
    q('paSales').innerHTML=Object.entries(salespeople).filter(([,person])=>types.includes(person.type)).map(([id,person])=>`<label class="pa-scope-option"><input type="checkbox" name="sales" value="${esc(id)}" ${selected.includes(id)?'checked':''}/><span>${esc(person.name)}</span></label>`).join('');
    syncSalesPicker();
  }
  function syncSalesPicker() {
    const label=salesName({sales:selectedSales()});
    q('paSalesValue').textContent=label;q('paSalesValue').title=label;
  }
  const selectPickers = [];
  function syncSelectPickers() {
    selectPickers.forEach(({select,picker,summary,value,list})=>{
      value.textContent=select.selectedOptions[0]?.textContent||'请选择';
      summary.setAttribute('aria-disabled',String(select.disabled));
      list.querySelectorAll('button').forEach(button=>{const option=[...select.options].find(option=>option.value===button.dataset.value);button.disabled=select.disabled||!option||option.disabled;button.hidden=!option||option.hidden;button.setAttribute('aria-selected',String(button.dataset.value===select.value));});
      if(select.disabled)picker.open=false;
    });
  }
  function wirePicker(picker) {
    const summary=picker.querySelector('summary');
    summary.setAttribute('aria-expanded',String(picker.open));
    summary.addEventListener('click',e=>{
      if(summary.getAttribute('aria-disabled')==='true'){e.preventDefault();return;}
      if(!picker.open)q('paEditor').querySelectorAll('.pa-scope-select[open]').forEach(other=>{if(other!==picker)other.open=false;});
    });
    picker.addEventListener('toggle',()=>summary.setAttribute('aria-expanded',String(picker.open)));
  }
  function initSelectPickers() {
    q('paEditor').querySelectorAll('select').forEach(select=>{
      const label=select.parentElement,field=document.createElement('div');
      field.className=(label.className+' pa-select-field').trim();if(label.id)field.id=label.id;
      const title=document.createElement('span');title.className='pa-field-label';title.id=select.id+'Label';title.textContent=[...label.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join('').trim();
      const picker=document.createElement('details');picker.className='pa-scope-select';picker.id=select.id+'Picker';
      const summary=document.createElement('summary'),value=document.createElement('span');value.id=select.id+'Value';summary.setAttribute('aria-labelledby',title.id+' '+value.id);summary.setAttribute('aria-haspopup','listbox');if(select.required)summary.setAttribute('aria-required','true');summary.append(value);
      const list=document.createElement('div');list.className='pa-scope-options';list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',title.id);
      [...select.options].forEach(option=>{
        const button=document.createElement('button');button.type='button';button.className='pa-dropdown-option';button.dataset.value=option.value;button.textContent=option.textContent;button.setAttribute('role','option');button.disabled=option.disabled;
        button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));picker.open=false;summary.focus();});list.append(button);
      });
      const helpers=[...label.querySelectorAll('small')];select.hidden=true;picker.append(summary,list);field.append(title,select,picker,...helpers);label.replaceWith(field);
      select.addEventListener('change',syncSelectPickers);selectPickers.push({select,picker,summary,value,list});wirePicker(picker);
    });
    wirePicker(q('paTargetTypesPicker'));wirePicker(q('paScopePicker'));wirePicker(q('paSalesPicker'));syncSelectPickers();
  }
  function syncScopePicker() {const kind=q('paScopeType').value,selected=selectedScopes(),labels=scopeOptions(kind);q('paScopesValue').textContent=kind==='all'?'全部产品':selected.length?selected.map(scope=>labels[scope]).join('、'):'请选择'+(kind==='category'?'适用产品分类':'适用产品');q('paScopesValue').title=q('paScopesValue').textContent;q('paScopesValue').classList.toggle('is-placeholder',kind!=='all'&&!selected.length);}
  function updateMode() {
    syncScopePicker();
    const mode=q('paMode').value, isPercent=mode==='percent';
    q('paValueLabel').textContent=isPercent?'让利值（%） *':'让利值（元/吨） *';
    q('paValue').min='0';
    if(isPercent)q('paValue').max='99.99';else q('paValue').removeAttribute('max');
    q('paValueHelp').textContent=isPercent?'填写2表示最多让利2%，不是打2折。':'';q('paValueHelp').hidden=!isPercent;
  }
  function openEditor(id=null) {
    const r=id?adminState.rules.find(r=>r.id===id):{name:'',types:['销售经理'],sales:[],scopeType:'all',scopes:[],mode:'percent',value:2,unit:'吨',cap:null,start:DEMO_DATE,end:'',enabled:true,remark:''};
    if(!r||r.legacy)return;
    if(!canManage(r.types)){toast(permissionError);return;}
    adminState.editing=id;
    q('paEditorForm').reset();q('paEditorTitle').textContent=id?'编辑折扣规则':'新增折扣规则';
    q('paRuleName').value=r.name;renderTargetTypeOptions(r.types);q('paTargetTypesPicker').open=false;renderSalesOptions(r.sales);q('paSalesPicker').open=false;q('paSalesHelp').textContent='可多选，不选则适用所选职级的全部销售。';
    q('paMode').value=r.mode;q('paScopeType').value=r.scopeType;renderScopeOptions(r.scopes);q('paScopePicker').open=false;updateMode();
    q('paValue').value=r.value;q('paCap').value=r.cap??'';q('paStart').value=r.start;q('paEnd').value=r.end;q('paEnd').min=r.start;q('paEnabled').value=String(r.enabled);q('paRemark').value=r.remark;
    q('paReasonField').hidden=!id;q('paReason').required=!!id;q('paFormError').hidden=true;
    selectPickers.forEach(({picker})=>{picker.open=false;});syncSelectPickers();
    q('paEditor').showModal();q('paRuleName').focus();
  }
  function readDraft() {return {id:adminState.editing||`SQ-${String(adminState.nextId).padStart(3,'0')}`,name:q('paRuleName').value.trim(),types:selectedTargetTypes(),sales:selectedSales(),scopeType:q('paScopeType').value,scopes:selectedScopes(),mode:q('paMode').value,value:Number(q('paValue').value),unit:'吨',cap:q('paCap').value===''?null:Number(q('paCap').value),start:q('paStart').value,end:q('paEnd').value,enabled:q('paEnabled').value==='true'?true:q('paEnabled').value==='false'?false:null,remark:q('paRemark').value.trim()};}
  function validateRule(r) {
    if(!r.name||r.name.length>60)return '请填写规则名称，最多60个字符。';
    if(!canView(r.types)||new Set(r.types).size!==r.types.length)return '请至少选择一个有效的适用职级。';
    if(!Array.isArray(r.sales)||r.sales.some(id=>!Object.hasOwn(salespeople,id)||!r.types.includes(salespeople[id].type))||new Set(r.sales).size!==r.sales.length)return '指定销售人员需属于所选适用职级，请重新选择。';
    if(typeof r.enabled!=='boolean')return '请选择状态：启用或停用。';
    if(typeof r.remark!=='string'||r.remark.length>300)return '备注最多填写300个字符。';
    if(!Object.hasOwn(scopeTypes,r.scopeType)||!Array.isArray(r.scopes))return '请选择有效的适用范围。';
    if(r.scopeType==='all'&&r.scopes.length)return '选择全部产品时无需再选择产品分类或指定产品。';
    if(r.scopeType!=='all'&&(!r.scopes.length||r.scopes.some(scope=>!Object.hasOwn(scopeOptions(r.scopeType),scope))||new Set(r.scopes).size!==r.scopes.length))return '请选择至少一个产品分类或指定产品。';
    if(!Object.hasOwn(modes,r.mode))return '请选择有效的让利方式。';
    if(r.unit!=='吨')return '固定金额统一按元/吨配置。';
    if(!Number.isFinite(r.value)||r.value<0||Math.abs(r.value*100-Math.round(r.value*100))>1e-7)return '让利值必须为非负数，最多保留两位小数。';
    if(r.mode==='percent'&&r.value>=100)return '按百分比让利时，让利值须小于100%。';
    if(r.cap!==null&&(!Number.isFinite(r.cap)||r.cap<=0||Math.abs(r.cap*100-Math.round(r.cap*100))>1e-7))return '单笔让利上限须大于0，最多保留两位小数；不限制时请留空。';
    const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
    if(!validDate(r.start)||!validDate(r.end))return '请选择完整有效的开始和结束日期。';
    if(r.end<r.start)return '结束日期不能早于开始日期。';
    return '';
  }
  function intersect(a,b) {const right=new Set(b);return a.filter(value=>right.has(value));}
  function findRuleConflict(candidate) {
    if(!candidate.enabled)return null;
    for(const existing of adminState.rules) {
      if(existing.id===candidate.id||!existing.enabled||existing.scopeType!==candidate.scopeType)continue;
      const overlappingTypes=intersect(candidate.types,existing.types);
      if(!overlappingTypes.length)continue;
      const candidateIsPersonal=candidate.sales.length>0,existingIsPersonal=existing.sales.length>0;
      if(candidateIsPersonal!==existingIsPersonal)continue;
      const overlappingSales=candidateIsPersonal?intersect(candidate.sales,existing.sales):[];
      if(candidateIsPersonal&&!overlappingSales.length)continue;
      const overlappingScopes=candidate.scopeType==='all'?['全部产品']:intersect(candidate.scopes,existing.scopes);
      if(!overlappingScopes.length)continue;
      const overlapStart=candidate.start>existing.start?candidate.start:existing.start;
      const overlapEnd=candidate.end<existing.end?candidate.end:existing.end;
      if(overlapStart>overlapEnd)continue;
      return {rule:existing,types:overlappingTypes,sales:overlappingSales,scopes:overlappingScopes,start:overlapStart,end:overlapEnd};
    }
    return null;
  }
  function conflictMessage(candidate) {
    const conflict=findRuleConflict(candidate);if(!conflict)return '';
    return `无法保存：这条规则与“${conflict.rule.name}”重复，请修改后再保存。`;
  }
  const diffLabels={name:'规则名称',types:'适用职级',sales:'指定销售人员',scopeType:'适用范围',scopes:'适用产品',mode:'让利方式',value:'让利值',unit:'计价单位',cap:'单笔让利上限',start:'生效日期',end:'失效日期',enabled:'状态',remark:'备注'};
  function diffValue(key,value,r) {if(key==='types')return typeName(r);if(key==='sales')return salesName(r);if(key==='enabled')return value?'启用':'停用';if(key==='scopeType')return scopeTypes[value];if(key==='scopes')return scopeName(r);if(key==='mode')return modes[value];if(key==='value')return ruleValue(r);if(key==='cap')return value===null?'不限':money(value);if(key==='end')return value||'长期有效';return value||'未填写';}
  function recordModification(rule,changes,reason,prior=rule) {adminState.logs.unshift({logId:`change-${adminState.nextLogId++}`,id:rule.id,name:rule.name,types:[...new Set([...prior.types,...rule.types])],changes,reason,operator:adminState.operator,time:new Date().toLocaleString('zh-CN',{hour12:false})});}
  function saveEditor(event) {
    event.preventDefault();if(!q('paEditor').open||!q('paEditorForm').reportValidity())return;
    const r=readDraft(),reason=q('paReason').value.trim(),prior=adminState.rules.find(x=>x.id===r.id);
    r.creator=prior?.creator||adminState.operator;
    const error=(!canManage(r.types)||(prior&&!canManage(prior.types))?permissionError:'')||validateRule(r)||conflictMessage(r)||(adminState.editing&&!reason?'请填写本次修改原因。':'');
    if(error){q('paFormError').textContent=error;q('paFormError').hidden=false;q('paFormError').scrollIntoView({block:'nearest'});return;}
    if(prior){const changes=Object.keys(diffLabels).filter(key=>['types','scopes','sales'].includes(key)?JSON.stringify([...prior[key]].sort())!==JSON.stringify([...r[key]].sort()):key==='value'?ruleValue(prior)!==ruleValue(r):prior[key]!==r[key]).map(key=>({field:diffLabels[key],before:diffValue(key,prior[key],prior),after:diffValue(key,r[key],r)}));if(!changes.length){q('paEditor').close();toast('规则未变更');return;}adminState.rules[adminState.rules.indexOf(prior)]=r;recordModification(r,changes,reason,prior);}
    else{adminState.rules.unshift(r);adminState.nextId++;}
    q('paEditor').close();renderAll();toast('规则保存成功');
  }
  function openToggle(id) {
    const r=adminState.rules.find(r=>r.id===id);if(!r||r.legacy)return;
    if(!canManage(r.types)){toast(permissionError);return;}
    adminState.toggling=id;q('paConfirmTitle').textContent=r.enabled?'停用折扣规则':'启用折扣规则';q('paConfirmSave').textContent=r.enabled?'确认停用':'确认启用';
    q('paConfirmText').textContent=r.enabled?'停用后，这条规则将不再使用。':'启用后，这条规则将开始使用。';
    q('paToggleReason').value='';q('paToggleError').hidden=true;q('paConfirm').showModal();q('paToggleReason').focus();
  }
  function saveToggle(event) {
    event.preventDefault();if(!q('paConfirm').open)return;const r=adminState.rules.find(r=>r.id===adminState.toggling),reason=q('paToggleReason').value.trim();if(!r||!reason)return;
    const next={...r,enabled:!r.enabled},error=(!canManage(r.types)?permissionError:'')||validateRule(next)||conflictMessage(next);
    if(error){q('paToggleError').textContent=error;q('paToggleError').hidden=false;return;}
    const change={field:'状态',before:r.enabled?'启用':'停用',after:next.enabled?'启用':'停用'};
    Object.assign(r,next);recordModification(r,[change],reason);q('paConfirm').close();renderAll();toast(r.enabled?'已启用':'已停用');
  }

  function auditLogs() {
    return [...adminState.logs,{logId:'example',id:'SQ-001',example:true,name:'销售经理通用让利',changes:[{field:'让利值',before:'1.5%',after:'2%'}],reason:'销售经理让利调整',operator:'运营（示例）',time:'2026-09-22 10:00:00'}];
  }
  let auditDetailTrigger=null;
  function openAuditDetail(button) {
    const rule=adminState.rules.find(rule=>rule.id===button.dataset.paAuditOpen);
    if(!rule)return;
    auditDetailTrigger=button;
    const logs=auditLogs().filter(log=>log.id===rule.id);
    q('paAuditRuleName').textContent=rule.name;
    q('paAuditRuleTypes').textContent=audienceName(rule);
    q('paAuditHistory').innerHTML=logs.map(log=>`<section class="pa-history-entry"><table class="pa-change-table"><thead><tr><th scope="col">修改字段</th><th scope="col">修改前</th><th scope="col">修改后</th><th scope="col">操作人</th><th scope="col">操作原因</th><th scope="col">修改时间</th></tr></thead><tbody>${log.changes.map(change=>`<tr><th scope="row">${esc(change.field)}</th><td>${esc(change.before)}</td><td>${esc(change.after)}</td><td>${esc(log.operator)}</td><td>${esc(log.reason)}</td><td>${esc(log.time)}</td></tr>`).join('')}</tbody></table></section>`).join('')||'<p class="pa-history-empty">暂无变更记录</p>';
    q('paAuditDialog').showModal();q('paAuditDialog').querySelector('[data-pa-audit-close]').focus();
    q('paAuditDialog').querySelector('.pa-editor-body').scrollTop=0;
  }
  function closeAuditDetail() {
    const trigger=auditDetailTrigger;auditDetailTrigger=null;q('paAuditDialog').close();
    q('paAuditHistory').replaceChildren();q('paAuditRuleName').textContent='';q('paAuditRuleTypes').textContent='';
    if(trigger?.isConnected)trigger.focus();
  }
  function renderAll(){renderRules();}
  function createFromAgent(input) {
    const types=Array.isArray(input?.targetTypes)?[...input.targetTypes]:input?.targetType?[input.targetType]:[];
    if(!canManage(types))throw new Error(`请选择有效的适用职级：${targetTypes.join('、')}。`);
    if(input.targetMode!==undefined||input.people!==undefined)throw new Error('请使用 targetTypes 选择适用职级，并在 sales 中传入指定销售 ID。');
    if(input.scope!==undefined||input.scopeTarget!==undefined)throw new Error('请使用 scopeType 选择 all、category 或 product，并在需要时通过 scopes 传入产品分类或产品 ID。');
    if(!Object.hasOwn(modes,input.discountType))throw new Error('让利方式仅支持按百分比或固定金额。');
    const scopeType=input.scopeType||'all';
    const r={id:`SQ-${String(adminState.nextId).padStart(3,'0')}`,name:String(input.name||'').trim(),types,sales:input.sales===undefined?[]:Array.isArray(input.sales)?[...input.sales]:input.sales,scopeType,scopes:scopeType==='all'?[]:Array.isArray(input.scopes)?[...input.scopes]:[],mode:input.discountType,value:input.value,unit:input.unit||'吨',cap:input.cap??null,start:input.start||DEMO_DATE,end:input.end||'',enabled:true,creator:adminState.operator,remark:typeof input.remark==='string'?input.remark.trim():''};
    const error=validateRule(r)||conflictMessage(r);if(error)throw new Error(error);adminState.rules.unshift(r);adminState.nextId++;renderAll();return {status:'created',scope:'admin-demo-only',rule:structuredClone(r)};
  }

  initSelectPickers();
  q('paAdd').addEventListener('click',()=>openEditor());
  q('paRequirements').addEventListener('click',()=>{q('paRequirementsDialog').showModal();q('paRequirementsDialog').querySelector('.pa-editor-body').scrollTop=0;});
  q('paFilters').addEventListener('submit',e=>{e.preventDefault();adminState.filters={search:q('paSearch').value.trim(),type:q('paTypeFilter').value,status:q('paStatusFilter').value};renderRules();});
  q('paFilters').addEventListener('reset',()=>{adminState.filters={search:'',type:'',status:''};renderRules();});
  root.addEventListener('click',e=>{
    const el=e.target.closest('button');if(!el)return;
    if(el.dataset.paEdit)openEditor(el.dataset.paEdit);
    if(el.dataset.paToggle)openToggle(el.dataset.paToggle);
    if(el.dataset.paAuditOpen)openAuditDetail(el);
    if(el.dataset.paLegacy)toast('原运营权限仅保留为历史记录，不参与销售权限匹配；优惠券由运营另行维护。');
  });
  q('paSales').addEventListener('change',syncSalesPicker);
  q('paTargetTypes').addEventListener('change',()=>{const before=selectedSales();syncTargetTypesPicker();const retained=before.filter(id=>selectedTargetTypes().includes(salespeople[id]?.type));renderSalesOptions(retained);q('paSalesPicker').open=false;q('paSalesHelp').textContent=before.length!==retained.length?'已清除不属于所选职级的销售人员；不选则适用所选职级的全部销售。':'可多选，不选则适用所选职级的全部销售。';});
  q('paScopes').addEventListener('change',updateMode);q('paMode').addEventListener('change',updateMode);q('paScopeType').addEventListener('change',()=>{renderScopeOptions();q('paScopePicker').open=false;});
  document.addEventListener('click',e=>{q('paEditor').querySelectorAll('.pa-scope-select[open]').forEach(picker=>{if(!picker.contains(e.target))picker.open=false;});});
  q('paEditor').addEventListener('keydown',e=>{
    const picker=e.target.closest('.pa-scope-select');if(!picker)return;const summary=picker.querySelector('summary');
    if(e.key==='Escape'&&picker.open){e.preventDefault();e.stopPropagation();picker.open=false;summary.focus();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
    const options=[...picker.querySelectorAll('.pa-dropdown-option:not(:disabled),input[type="checkbox"]')];if(!options.length)return;
    e.preventDefault();picker.open=true;const i=options.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?options.length-1:i<0?(e.key==='ArrowUp'?options.length-1:0):(i+(e.key==='ArrowUp'?-1:1)+options.length)%options.length;options[next].focus();
  });
  q('paStart').addEventListener('change',()=>{q('paEnd').min=q('paStart').value;});
  q('paEditorForm').addEventListener('submit',saveEditor);q('paConfirmForm').addEventListener('submit',saveToggle);
  q('paEditor').querySelectorAll('[data-pa-close]').forEach(el=>el.addEventListener('click',()=>q('paEditor').close()));
  q('paConfirmClose').addEventListener('click',()=>q('paConfirm').close());q('paConfirmCancel').addEventListener('click',()=>q('paConfirm').close());
  q('paAuditDialog').querySelectorAll('[data-pa-audit-close]').forEach(button=>button.addEventListener('click',closeAuditDetail));
  q('paAuditDialog').addEventListener('cancel',event=>{event.preventDefault();closeAuditDetail();});
  q('paRequirementsDialog').querySelectorAll('[data-pa-requirements-close]').forEach(button=>button.addEventListener('click',()=>q('paRequirementsDialog').close()));
  window.PermissionAdmin=Object.freeze({create:createFromAgent});
  renderAll();
})();
