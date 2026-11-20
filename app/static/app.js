'use strict';
// Интерфейс обращается к существующему FastAPI. Данные не дублируются в браузере.
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => window.uiIcon ? window.uiIcon(({calendar:'grid',edit:'sliders'})[name] || name) : '';
const state = { courses: [], groups: [], page: location.hash === '#groups' ? 'groups' : 'programs', selected: null, detail: null, query: '', status: 'all', loading: false, error: '', detailError: '', detailLoading: false, editing: null, saving: false };
let detailRequest = 0;
let notificationTimer;

function applyIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' ? 'Сервер долго не отвечает. Проверьте соединение и обновите список.' : 'Не удалось связаться с сервером. Убедитесь, что приложение запущено.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('Сервер вернул неожиданный ответ. Попробуйте обновить страницу.'); }
  if (!response.ok) {
    const names = {name:'Название', description:'Описание', duration_hours:'Продолжительность', teacher:'Преподаватель', course_id:'Программа', date_start:'Дата начала', date_end:'Дата окончания'};
    if (Array.isArray(data.detail)) {
      throw new Error(data.detail.map(item => {
        const field = names[item.loc?.at(-1)] || 'Данные';
        if (item.type === 'missing') return `${field}: заполните обязательное поле.`;
        if (item.type === 'greater_than') return `${field}: значение должно быть больше нуля.`;
        if (item.type === 'string_too_short') return `${field}: введите текст.`;
        return `${field}: проверьте указанное значение.`;
      }).join('\n'));
    }
    throw new Error(typeof data.detail === 'string' ? data.detail : `Ошибка сервера (${response.status}). Изменения не подтверждены.`);
  }
  return data;
}

function localToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function groupStatus(group) { const today=localToday(); return today < group.date_start ? 'planned' : today > group.date_end ? 'finished' : 'active'; }
const statusTitles = {planned:'Запланирована',active:'Идёт обучение',finished:'Завершена'};
function badge(group) { const s=groupStatus(group); return `<span class="ui-badge ${s==='active'?'ui-badge--ok':s==='planned'?'ui-badge--info':''}">${statusTitles[s]}</span>`; }
function formatDate(value) { if (!value) return '—'; const [year,month,day]=value.split('-'); return `${day}.${month}.${year}`; }
function courseFor(group) { return state.courses.find(course => course.id === group.course_id); }
function displayCourse(group) { return courseFor(group)?.name || `Программа №${group.course_id}`; }
function filteredRecords() {
  const records=state.page==='programs'?state.courses:state.groups;
  const q=state.query.trim().toLocaleLowerCase('ru');
  return records.filter(record => {
    const text=state.page==='programs'?`${record.id} ${record.name} ${record.description} ${record.teacher}`:`${record.id} ${displayCourse(record)} ${courseFor(record)?.teacher||''} ${record.date_start} ${record.date_end}`;
    return text.toLocaleLowerCase('ru').includes(q) && (state.page==='programs'||state.status==='all'||groupStatus(record)===state.status);
  });
}
function notify(message) { const node=$('#notification'); node.textContent=message;node.hidden=false;clearTimeout(notificationTimer);notificationTimer=setTimeout(()=>node.hidden=true,6000); }

async function loadData() {
  state.loading=true;state.error='';render();
  try {
    const [courses, groups]=await Promise.all([api('/courses'),api('/groups')]);
    if (!Array.isArray(courses)||!Array.isArray(groups)) throw new Error('Сервер вернул неожиданный формат списка.');
    state.courses=courses;state.groups=groups;
  } catch(error) { state.error=error.message; }
  state.loading=false;render();
  if (!state.error && state.selected!==null) await selectRecord(state.selected);
  return !state.error;
}

function render() {
  const programs=state.page==='programs';
  document.title=`${programs?'Программы обучения':'Учебные группы'} — Feedback`;
  $('#program-nav').toggleAttribute('aria-current',programs);if(programs)$('#program-nav').setAttribute('aria-current','page');
  $('#group-nav').toggleAttribute('aria-current',!programs);if(!programs)$('#group-nav').setAttribute('aria-current','page');
  $('#section-title').textContent=programs?'Программы обучения':'Учебные группы';
  $('#section-description').textContent=programs?'Выберите программу, чтобы посмотреть описание и связанные группы.':'Каждая группа — отдельное проведение программы в выбранные даты.';
  $('#create-label').textContent=programs?'Создать программу':'Создать группу';
  $('#create-button').disabled=state.loading||Boolean(state.error);
  $('#refresh-button').disabled=state.loading;
  $('#search').placeholder=programs?'Название или преподаватель':'Номер группы или программа';
  $('#filter-label').hidden=programs;
  $('#program-count').textContent=state.error?'—':state.courses.length;
  $('#group-count').textContent=state.error?'—':state.groups.length;
  $('#active-count').textContent=state.error?'—':state.groups.filter(g=>groupStatus(g)==='active').length;
  $('#loading').hidden=!state.loading;
  $('#content-grid').hidden=state.loading||Boolean(state.error);
  $('#load-error').hidden=!state.error;$('#load-error').textContent=state.error;
  $('#list-hint').textContent=programs?'Нажмите на название, чтобы открыть карточку программы.':'Нажмите на номер группы, чтобы открыть её карточку. Статус определяется по датам.';
  renderTable();renderDetail();applyIcons();
}

function renderTable() {
  const programs=state.page==='programs';const records=filteredRecords();
  $('#result-count').textContent=state.loading?'':`Найдено: ${records.length}`;
  $('#table-wrap').hidden=!records.length;$('#empty-state').hidden=Boolean(records.length);
  if (!records.length) {
    const hasFilters=Boolean(state.query.trim())||(!programs&&state.status!=='all');
    $('#empty-state').innerHTML=`<div class="ui-empty"><div class="ui-icon-tile">${icon(programs?'layers':'calendar')}</div><div class="ui-empty__title">${hasFilters?'Ничего не найдено':programs?'Добавьте первую программу':'Создайте первую группу'}</div><p class="ui-empty__text ui-muted">${hasFilters?'Измените запрос или сбросьте фильтры.':programs?'Укажите название, содержание и продолжительность обучения. Затем можно будет сформировать группы.':'Выберите программу и даты обучения. Группа появится в этом списке.'}</p><div class="ui-empty__actions"><button class="ui-btn" data-action="${hasFilters?'reset-filters':'create'}">${hasFilters?'Сбросить фильтры':programs?'Создать программу':'Создать группу'}</button></div></div>`;
  }
  $('#table-head').innerHTML=programs?'<tr><th>ID</th><th>Программа</th><th class="teacher-column">Преподаватель</th><th class="num">Часы</th></tr>':'<tr><th>ID</th><th>Группа / программа</th><th>Период</th></tr>';
  $('#table-body').innerHTML=records.map(record=>{
    const selected=record.id===state.selected?' data-selected="true"':'';
    return programs?`<tr${selected}><td class="ui-num">${record.id}</td><td><button class="record-button" data-open="${record.id}">${escapeHTML(record.name)}</button><span class="record-meta">${escapeHTML(record.description.length>90?record.description.slice(0,90)+'…':record.description||'Без описания')}</span></td><td class="teacher-column">${escapeHTML(record.teacher||'Не указан')}</td><td class="num">${record.duration_hours}</td></tr>`:`<tr${selected}><td class="ui-num">${record.id}</td><td><button class="record-button" data-open="${record.id}">Группа №${record.id}</button><span class="record-meta">${escapeHTML(displayCourse(record))}</span><div style="margin-top:8px">${badge(record)}</div></td><td class="date-cell">${formatDate(record.date_start)}<br><span class="ui-faint">${formatDate(record.date_end)}</span></td></tr>`;
  }).join('');
}

function renderDetail() {
  const node=$('#detail');const programs=state.page==='programs';node.setAttribute('aria-busy',String(state.detailLoading));
  if (state.detailLoading) {node.innerHTML='<div class="loading-state"><span class="ui-spinner"></span> Загружаем карточку…</div>';return;}
  if (state.detailError) {node.innerHTML=`<div class="detail-placeholder"><h3>Не удалось открыть карточку</h3><p class="ui-muted">${escapeHTML(state.detailError)}</p><button class="ui-btn" data-action="retry-detail" style="margin-top:16px">Повторить</button></div>`;return;}
  const record=state.detail;
  if (!record) {node.innerHTML=`<div class="detail-placeholder">${icon(programs?'layers':'calendar')}<h3>${programs?'О программе':'О группе'}</h3><p class="ui-muted">${programs?'Выберите программу в списке. Здесь появятся описание, преподаватель и группы обучения.':'Выберите группу в списке. Здесь появятся даты, статус и информация о программе.'}</p></div>`;return;}
  const kv=(key,value)=>`<dt>${escapeHTML(key)}</dt><dd>${escapeHTML(value)}</dd>`;
  const linked=programs?state.groups.filter(g=>g.course_id===record.id):[];
  node.innerHTML=`<div class="detail-head"><div class="detail-icon">${icon(programs?'layers':'calendar')}</div><span class="ui-eyebrow">${programs?'Программа':'Учебная группа'} №${record.id}</span><h3>${programs?escapeHTML(record.name):'Группа №'+record.id}</h3></div><div class="detail-body">${programs?`<p class="detail-description">${escapeHTML(record.description||'Описание пока не добавлено.')}</p><dl class="ui-kv">${kv('Продолжительность',record.duration_hours+' ч')}${kv('Преподаватель',record.teacher||'Не указан')}</dl><div class="detail-subsection"><h4>Учебные группы · ${linked.length}</h4>${linked.length?linked.map(g=>`<button class="detail-group" data-linked-group="${g.id}">Группа №${g.id} · ${formatDate(g.date_start)}</button>`).join(''):'<p class="ui-muted" style="font-size:14px;line-height:1.7">По этой программе групп ещё нет.</p>'}</div>`:`<div style="margin-bottom:20px">${badge(record)}</div><dl class="ui-kv">${kv('Программа',displayCourse(record))}${kv('Начало обучения',formatDate(record.date_start))}${kv('Окончание обучения',formatDate(record.date_end))}${kv('Преподаватель программы',courseFor(record)?.teacher||'Не указан')}${kv('Продолжительность программы',(courseFor(record)?.duration_hours??'—')+' ч')}</dl>`}</div><div class="detail-actions"><button class="ui-btn" data-action="edit">${icon('edit')}Редактировать</button>${programs?'<button class="ui-btn" data-action="group-for-course">'+icon('plus')+'Создать группу</button>':'<button class="ui-btn ui-btn--ghost" data-linked-course="'+record.course_id+'">Открыть программу</button>'}</div>`;
}

async function selectRecord(id) {
  const requestId=++detailRequest;state.selected=Number(id);state.detail=null;state.detailError='';state.detailLoading=true;renderTable();renderDetail();
  try { const detail=await api(`/${state.page==='programs'?'courses':'groups'}/${id}`);if(requestId!==detailRequest)return;state.detail=detail; }
  catch(error){if(requestId!==detailRequest)return;state.detailError=error.message;}
  state.detailLoading=false;renderDetail();
}

function switchPage(page) {
  if(state.page===page)return;detailRequest++;state.page=page;state.selected=null;state.detail=null;state.detailError='';state.detailLoading=false;state.query='';state.status='all';$('#search').value='';$('#status-filter').value='all';render();
}

function field(label,id,html,full=false,hint='') {return `<div class="ui-field ${full?'full':''}"><label for="${id}">${label}</label>${html}${hint?`<span class="ui-field__hint">${hint}</span>`:''}</div>`;}
function openEditor(edit=false, courseId=null) {
  if(state.loading||state.error)return;
  const programs=state.page==='programs';
  if(!programs&&!state.courses.length){notify('Сначала создайте программу обучения.');location.hash='programs';return;}
  const record=edit?state.detail:null;if(edit&&!record)return;
  state.editing={page:state.page,id:record?.id??null};
  $('#editor-title').textContent=edit?(programs?'Редактировать программу':'Редактировать группу'):(programs?'Новая программа':'Новая учебная группа');
  $('#editor-description').textContent=programs?'Программа описывает содержание обучения. На её основе можно создавать группы с разными датами.':'Выберите программу и период обучения. Даты могут совпадать, если обучение занимает один день.';
  $('#save-button').textContent=edit?'Сохранить изменения':programs?'Создать программу':'Создать группу';
  $('#form-error').hidden=true;$('#form-error').textContent='';
  if(programs){$('#form-fields').innerHTML=field('Название программы','course-name',`<input class="ui-input" id="course-name" name="name" required value="${escapeHTML(record?.name||'')}" placeholder="Например, основы проектирования в NX">`,true)+field('Краткое описание','course-description',`<textarea class="ui-textarea" id="course-description" name="description" placeholder="Чему научится слушатель">${escapeHTML(record?.description||'')}</textarea>`,true)+field('Продолжительность, ч','course-duration',`<input class="ui-input" id="course-duration" name="duration_hours" type="number" min="1" step="1" required value="${record?.duration_hours??''}" placeholder="16">`)+field('Преподаватель','course-teacher',`<input class="ui-input" id="course-teacher" name="teacher" value="${escapeHTML(record?.teacher||'')}" placeholder="Фамилия и имя">`);}
  else {const selected=record?.course_id??courseId??state.courses[0].id;$('#form-fields').innerHTML=field('Программа обучения','group-course',`<select class="ui-select" id="group-course" name="course_id" required>${state.courses.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}</select>`,true)+field('Начало обучения','group-start',`<input class="ui-input" id="group-start" name="date_start" type="date" required value="${record?.date_start||''}">`)+field('Окончание обучения','group-end',`<input class="ui-input" id="group-end" name="date_end" type="date" required value="${record?.date_end||''}">`);syncDates();}
  $('#editor').showModal();setTimeout(()=>$('#form-fields input, #form-fields select')?.focus(),0);
}
function syncDates(){const start=$('#group-start'),end=$('#group-end');if(!start||!end)return;end.min=start.value;end.setCustomValidity(end.value&&start.value&&end.value<start.value?'Дата окончания не может быть раньше даты начала':'');}
function closeEditor(){if(!state.saving)$('#editor').close();}

$('#editor-form').addEventListener('submit',async event=>{
  event.preventDefault();if(state.saving)return;syncDates();if(!event.target.reportValidity())return;
  const raw=Object.fromEntries(new FormData(event.target));const programs=state.editing.page==='programs';
  const payload=programs?{name:raw.name.trim(),description:raw.description.trim(),duration_hours:Number(raw.duration_hours),teacher:raw.teacher.trim()}:{course_id:Number(raw.course_id),date_start:raw.date_start,date_end:raw.date_end};
  if(programs&&!payload.name){$('#course-name').setCustomValidity('Введите название, а не только пробелы.');$('#course-name').reportValidity();return;}
  const id=state.editing.id;state.saving=true;$('#save-button').disabled=true;$('#save-button').textContent='Сохраняем…';$('#form-error').hidden=true;
  $('#editor').querySelectorAll('[data-close]').forEach(b=>b.disabled=true);
  try {
    await api(`/${programs?'courses':'groups'}${id!==null?'/'+id:''}`,{method:id!==null?'PUT':'POST',body:JSON.stringify(payload)});
    $('#editor').close();state.query='';$('#search').value='';state.status='all';$('#status-filter').value='all';
    const loaded=await loadData();
    notify(loaded?(id!==null?'Изменения сохранены.':programs?'Программа создана.':'Учебная группа создана.'):'Изменения сохранены, но список не обновился. Нажмите «Обновить».');
  } catch(error) {$('#form-error').textContent=error.message;$('#form-error').hidden=false;}
  finally {state.saving=false;$('#save-button').disabled=false;$('#save-button').textContent=id!==null?'Сохранить изменения':programs?'Создать программу':'Создать группу';$('#editor').querySelectorAll('[data-close]').forEach(b=>b.disabled=false);}
});
$('#editor').addEventListener('cancel',event=>{if(state.saving)event.preventDefault();});
$('#editor').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeEditor();});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.matches('[data-close]')){closeEditor();return;}
  if(button.dataset.open){selectRecord(button.dataset.open);return;}
  if(button.dataset.linkedGroup){switchPage('groups');location.hash='groups';selectRecord(button.dataset.linkedGroup);return;}
  if(button.dataset.linkedCourse){switchPage('programs');location.hash='programs';selectRecord(button.dataset.linkedCourse);return;}
  switch(button.dataset.action){case'edit':openEditor(true);break;case'create':openEditor();break;case'group-for-course':{const id=state.detail.id;switchPage('groups');location.hash='groups';openEditor(false,id);break;}case'reset-filters':state.query='';state.status='all';$('#search').value='';$('#status-filter').value='all';renderTable();break;case'retry-detail':selectRecord(state.selected);break;}
});
$('#search').addEventListener('input',event=>{state.query=event.target.value;renderTable();});
$('#status-filter').addEventListener('change',event=>{state.status=event.target.value;renderTable();});
$('#editor-form').addEventListener('input',event=>{if(event.target.id==='group-start'||event.target.id==='group-end')syncDates();if(event.target.id==='course-name')event.target.setCustomValidity('');});
$('#create-button').addEventListener('click',()=>openEditor());
$('#refresh-button').addEventListener('click',()=>loadData());
window.addEventListener('hashchange',()=>switchPage(location.hash==='#groups'?'groups':'programs'));
applyIcons();loadData();
