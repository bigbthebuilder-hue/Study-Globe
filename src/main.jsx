import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BookOpen,
  Boxes,
  ChevronDown,
  CirclePlus,
  Compass,
  Download,
  FileText,
  FolderOpen,
  Home,
  ImagePlus,
  Link2,
  Network,
  Pencil,
  Search,
  Settings,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import './styles.css';

const STORAGE_KEY = 'study-globe-v1-data';
const SUBJECT_TYPES = ['Person', 'Place', 'Quality', 'Event', 'Topic / Free Study'];
const MATERIAL_TYPES = [
  'Note',
  'Pasted Text',
  'Image',
  'Scripture / Reference',
  'Timeline Entry',
  'Research Question',
  'Personal Takeaway',
];
const DEFAULT_CATEGORIES = [
  'Bible Study',
  'People',
  'Places',
  'Qualities',
  'Events',
  'Ministry',
  'Family',
  'Meetings',
  'Convention / Assembly',
  'Personal Goals',
  'Research Question',
  'Talk / Part Prep',
  'Other',
];

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const norm = (value) => String(value || '').trim().toLowerCase();
const titleOf = (material) => material.title || material.body?.slice(0, 48) || material.type;
const byRecent = (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
const unique = (ids = []) => [...new Set(ids.filter(Boolean))];
const includes = (value, query) => norm(value).includes(norm(query));
const plural = (word, count) => `${word}${count === 1 ? '' : 's'}`;

function seedData() {
  return {
    version: 2,
    categories: DEFAULT_CATEGORIES.map((name, sortOrder) => ({
      id: uid(),
      name,
      sortOrder,
      isDefault: true,
      createdAt: now(),
    })),
    tags: [],
    projects: [],
    subjects: [],
    materials: [],
    createdAt: now(),
    updatedAt: now(),
  };
}

function migrateData(rawData) {
  const base = seedData();
  if (!rawData || typeof rawData !== 'object') return base;
  if (rawData.version === 2 && rawData.subjects && rawData.materials && rawData.projects) {
    return {
      ...base,
      ...rawData,
      version: 2,
      categories: rawData.categories?.length ? rawData.categories : base.categories,
      tags: rawData.tags || [],
      projects: rawData.projects || [],
      subjects: rawData.subjects || [],
      materials: rawData.materials || [],
    };
  }

  const categories = rawData.categories?.length ? rawData.categories : base.categories;
  const subjects = (rawData.topics || []).map((topic) => ({
    id: topic.id || uid(),
    type: 'Topic / Free Study',
    name: topic.name || 'Untitled Topic',
    categoryId: topic.categoryId || '',
    description: topic.description || '',
    tagIds: topic.tagIds || [],
    linkedProjectIds: [],
    linkedSubjectIds: [],
    materialIds: (rawData.items || []).filter((item) => item.topicId === topic.id).map((item) => item.id),
    fields: {},
    progressStatus: topic.manualStatus || '',
    createdAt: topic.createdAt || now(),
    updatedAt: topic.updatedAt || topic.createdAt || now(),
  }));
  const topicIds = new Set(subjects.map((subject) => subject.id));
  const materials = (rawData.items || []).map((item) => ({
    id: item.id || uid(),
    type: materialTypeFromOld(item.type),
    title: item.title || 'Untitled Material',
    body: item.body || '',
    imageData: item.imageData || '',
    source: item.source || '',
    scriptureRefs: item.scriptureRefs || '',
    personalTakeaway: item.personalTakeaway || '',
    tagIds: item.tagIds || [],
    linkedProjectIds: [],
    linkedSubjectIds: topicIds.has(item.topicId) ? [item.topicId] : [],
    createdAt: item.createdAt || now(),
    updatedAt: item.updatedAt || item.createdAt || now(),
  }));

  return {
    ...base,
    ...rawData,
    version: 2,
    categories,
    projects: [],
    subjects,
    materials,
    updatedAt: now(),
  };
}

function materialTypeFromOld(type) {
  if (type === 'pasted_text') return 'Pasted Text';
  if (type === 'image') return 'Image';
  if (type === 'research_question') return 'Research Question';
  return 'Note';
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateData(JSON.parse(raw)) : seedData();
  } catch {
    return seedData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, version: 2, updatedAt: now() }));
}

function App() {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState('home');
  const [activeProjectId, setActiveProjectId] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [activeMaterialId, setActiveMaterialId] = useState('');
  const [context, setContext] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => saveData(data), [data]);

  const refs = useMemo(() => makeRefs(data), [data]);
  const usage = useMemo(() => makeUsage(data), [data]);

  const tell = (message) => {
    setNotice(message);
    window.clearTimeout(tell.timer);
    tell.timer = window.setTimeout(() => setNotice(''), 2400);
  };

  const updateData = (updater, message) => {
    setData((current) => (typeof updater === 'function' ? updater(current) : updater));
    if (message) tell(message);
  };

  const ensureTags = (tagText, current) => {
    const names = String(tagText || '').split(',').map((name) => name.trim()).filter(Boolean);
    const tags = [...current.tags];
    const tagIds = [];
    names.forEach((name) => {
      const existing = tags.find((tagItem) => norm(tagItem.name) === norm(name));
      if (existing) tagIds.push(existing.id);
      else {
        const tag = { id: uid(), name, createdAt: now() };
        tags.push(tag);
        tagIds.push(tag.id);
      }
    });
    return { tags, tagIds: unique(tagIds) };
  };

  const createProject = (values, linkContext = context) => {
    const id = uid();
    updateData((current) => {
      const { tags, tagIds } = ensureTags(values.tags, current);
      const project = {
        id,
        name: values.name.trim(),
        description: values.description.trim(),
        tagIds,
        subjectIds: unique(values.subjectIds || []),
        materialIds: unique(values.materialIds || []),
        createdAt: now(),
        updatedAt: now(),
      };
      return linkNewProject(current, { ...project, tagIds }, tags, linkContext);
    }, 'Study saved');
    setActiveProjectId(id);
    setTab('projects');
    return id;
  };

  const createSubject = (values, linkContext = context) => {
    const id = uid();
    updateData((current) => {
      const { tags, tagIds } = ensureTags(values.tags, current);
      const subject = {
        id,
        type: values.type,
        name: values.name.trim(),
        categoryId: values.categoryId || '',
        description: values.description.trim(),
        tagIds,
        linkedProjectIds: unique(values.linkedProjectIds || []),
        linkedSubjectIds: unique(values.linkedSubjectIds || []),
        materialIds: unique(values.materialIds || []),
        fields: values.fields || {},
        progressStatus: values.progressStatus || '',
        createdAt: now(),
        updatedAt: now(),
      };
      return linkNewSubject(current, subject, tags, linkContext);
    }, 'Topic saved');
    setActiveSubjectId(id);
    setTab('subjects');
    return id;
  };

  const createMaterial = (values, linkContext = context) => {
    const id = uid();
    updateData((current) => {
      const { tags, tagIds } = ensureTags(values.tags, current);
      const material = {
        id,
        type: values.type,
        title: values.title.trim(),
        body: values.body.trim(),
        imageData: values.imageData || '',
        source: values.source.trim(),
        scriptureRefs: values.scriptureRefs.trim(),
        personalTakeaway: values.personalTakeaway.trim(),
        tagIds,
        linkedProjectIds: unique(values.linkedProjectIds || []),
        linkedSubjectIds: unique(values.linkedSubjectIds || []),
        createdAt: now(),
        updatedAt: now(),
      };
      return linkNewMaterial(current, material, tags, linkContext);
    }, 'Note saved');
    setActiveMaterialId(id);
    return id;
  };

  const linkExisting = (kind, id, linkContext = context) => {
    if (!linkContext || !id) return;
    updateData((current) => linkExistingRecord(current, kind, id, linkContext), 'Added');
  };

  const updateProject = (id, values) => updateData((current) => {
    const { tags, tagIds } = ensureTags(values.tags, current);
    return {
      ...current,
      tags,
      projects: current.projects.map((project) => project.id === id ? {
        ...project,
        name: values.name.trim(),
        description: values.description.trim(),
        tagIds,
        subjectIds: unique(values.subjectIds),
        materialIds: unique(values.materialIds),
        updatedAt: now(),
      } : project),
    };
  }, 'Study updated');

  const updateSubject = (id, values) => updateData((current) => {
    const { tags, tagIds } = ensureTags(values.tags, current);
    return {
      ...current,
      tags,
      subjects: current.subjects.map((subject) => subject.id === id ? {
        ...subject,
        type: values.type,
        name: values.name.trim(),
        categoryId: values.categoryId || '',
        description: values.description.trim(),
        tagIds,
        linkedProjectIds: unique(values.linkedProjectIds),
        linkedSubjectIds: unique(values.linkedSubjectIds).filter((subjectId) => subjectId !== id),
        materialIds: unique(values.materialIds),
        fields: values.fields || {},
        progressStatus: values.progressStatus || '',
        updatedAt: now(),
      } : subject),
    };
  }, 'Topic updated everywhere');

  const updateMaterial = (id, values) => updateData((current) => {
    const { tags, tagIds } = ensureTags(values.tags, current);
    return {
      ...current,
      tags,
      materials: current.materials.map((material) => material.id === id ? {
        ...material,
        type: values.type,
        title: values.title.trim(),
        body: values.body.trim(),
        imageData: values.imageData || '',
        source: values.source.trim(),
        scriptureRefs: values.scriptureRefs.trim(),
        personalTakeaway: values.personalTakeaway.trim(),
        tagIds,
        linkedProjectIds: unique(values.linkedProjectIds),
        linkedSubjectIds: unique(values.linkedSubjectIds),
        updatedAt: now(),
      } : material),
    };
  }, 'Note updated everywhere');

  const deleteProject = (id) => updateData((current) => ({
    ...current,
    projects: current.projects.filter((project) => project.id !== id),
    subjects: current.subjects.map((subject) => ({ ...subject, linkedProjectIds: (subject.linkedProjectIds || []).filter((projectId) => projectId !== id) })),
    materials: current.materials.map((material) => ({ ...material, linkedProjectIds: (material.linkedProjectIds || []).filter((projectId) => projectId !== id) })),
  }), 'Study deleted');

  const deleteSubject = (id) => updateData((current) => ({
    ...current,
    projects: current.projects.map((project) => ({ ...project, subjectIds: (project.subjectIds || []).filter((subjectId) => subjectId !== id) })),
    subjects: current.subjects
      .filter((subject) => subject.id !== id)
      .map((subject) => ({ ...subject, linkedSubjectIds: (subject.linkedSubjectIds || []).filter((subjectId) => subjectId !== id) })),
    materials: current.materials.map((material) => ({ ...material, linkedSubjectIds: (material.linkedSubjectIds || []).filter((subjectId) => subjectId !== id) })),
  }), 'Topic deleted');

  const deleteMaterial = (id) => updateData((current) => ({
    ...current,
    projects: current.projects.map((project) => ({ ...project, materialIds: (project.materialIds || []).filter((materialId) => materialId !== id) })),
    subjects: current.subjects.map((subject) => ({ ...subject, materialIds: (subject.materialIds || []).filter((materialId) => materialId !== id) })),
    materials: current.materials.filter((material) => material.id !== id),
  }), 'Note deleted');

  const addCategory = (name) => {
    if (!name.trim()) return;
    updateData((current) => ({
      ...current,
      categories: [...current.categories, { id: uid(), name: name.trim(), sortOrder: current.categories.length, isDefault: false, createdAt: now() }],
    }), 'Category added');
  };
  const renameCategory = (id, name) => updateData((current) => ({
    ...current,
    categories: current.categories.map((category) => category.id === id ? { ...category, name: name.trim() || category.name } : category),
  }), 'Category renamed');
  const deleteCategory = (id) => updateData((current) => ({
    ...current,
    categories: current.categories.filter((category) => category.id !== id),
    subjects: current.subjects.map((subject) => subject.categoryId === id ? { ...subject, categoryId: '' } : subject),
  }), 'Category deleted');
  const renameTag = (id, name) => updateData((current) => ({
    ...current,
    tags: current.tags.map((tagItem) => tagItem.id === id ? { ...tagItem, name: name.trim() || tagItem.name } : tagItem),
  }), 'Tag renamed everywhere');
  const deleteTag = (id) => updateData((current) => ({
    ...current,
    tags: current.tags.filter((tagItem) => tagItem.id !== id),
    projects: current.projects.map((project) => ({ ...project, tagIds: (project.tagIds || []).filter((tagId) => tagId !== id) })),
    subjects: current.subjects.map((subject) => ({ ...subject, tagIds: (subject.tagIds || []).filter((tagId) => tagId !== id) })),
    materials: current.materials.map((material) => ({ ...material, tagIds: (material.tagIds || []).filter((tagId) => tagId !== id) })),
  }), 'Tag removed everywhere');

  const openCreate = (kind, nextContext = null) => {
    setContext(nextContext);
    setTab(`create-${kind}`);
  };

  const goHome = () => {
    setContext(null);
    setTab('home');
  };

  const commonProps = {
    data,
    refs,
    usage,
    setTab,
    openCreate,
    createProject,
    createSubject,
    createMaterial,
    linkExisting,
    updateProject,
    updateSubject,
    updateMaterial,
    deleteProject,
    deleteSubject,
    deleteMaterial,
    setActiveProjectId,
    setActiveSubjectId,
    setActiveMaterialId,
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={goHome} aria-label="Home">
          <Compass size={26} />
          <span><strong>Study Globe</strong><small>v2 local study workspace</small></span>
        </button>
        <button className="icon-button" onClick={() => setSettingsOpen(true)} title="Settings"><Settings size={20} /></button>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <main>
        {tab === 'home' && <HomeScreen {...commonProps} openSettings={() => setSettingsOpen(true)} />}
        {tab === 'guided-add' && <GuidedAddScreen {...commonProps} onDone={goHome} />}
        {tab === 'explore' && <ExploreScreen {...commonProps} />}
        {tab === 'material-detail' && <MaterialDetailScreen {...commonProps} activeMaterialId={activeMaterialId} />}
        {tab === 'projects' && <ProjectsScreen {...commonProps} activeProjectId={activeProjectId} />}
        {tab === 'subjects' && <SubjectsScreen {...commonProps} activeSubjectId={activeSubjectId} />}
        {tab === 'search' && <SearchScreen {...commonProps} />}
        {tab === 'connections' && <ConnectionsScreen {...commonProps} />}
        {tab === 'create-project' && <ProjectForm data={data} refs={refs} onSubmit={createProject} onCancel={() => setTab('projects')} />}
        {tab === 'create-subject' && <SubjectCreateFlow data={data} refs={refs} usage={usage} onCreate={createSubject} onLink={linkExisting} context={context} onCancel={() => setTab(context?.type === 'project' ? 'projects' : 'subjects')} />}
        {tab === 'create-material' && <MaterialFinder data={data} refs={refs} usage={usage} onCreate={createMaterial} onLink={linkExisting} context={context} onCancel={() => setTab(context?.type === 'project' ? 'projects' : 'subjects')} />}
      </main>

      {settingsOpen && <SettingsPanel data={data} setData={setData} addCategory={addCategory} renameCategory={renameCategory} deleteCategory={deleteCategory} renameTag={renameTag} deleteTag={deleteTag} onClose={() => setSettingsOpen(false)} />}

      <nav className="bottom-nav">
        <NavButton label="Home" icon={<Home />} active={tab === 'home'} onClick={goHome} />
        <NavButton label="Add" icon={<CirclePlus />} active={tab === 'guided-add'} onClick={() => setTab('guided-add')} />
        <NavButton label="Explore" icon={<Compass />} active={tab === 'explore'} onClick={() => setTab('explore')} />
        <NavButton label="Search" icon={<Search />} active={tab === 'search'} onClick={() => setTab('search')} />
        <NavButton label="Links" icon={<Network />} active={tab === 'connections'} onClick={() => setTab('connections')} />
      </nav>
    </div>
  );
}

function makeRefs(data) {
  return {
    categories: Object.fromEntries(data.categories.map((item) => [item.id, item])),
    tags: Object.fromEntries(data.tags.map((item) => [item.id, item])),
    projects: Object.fromEntries(data.projects.map((item) => [item.id, item])),
    subjects: Object.fromEntries(data.subjects.map((item) => [item.id, item])),
    materials: Object.fromEntries(data.materials.map((item) => [item.id, item])),
  };
}

function makeUsage(data) {
  const subjectUsage = {};
  const materialUsage = {};
  data.subjects.forEach((subject) => {
    subjectUsage[subject.id] = {
      projects: data.projects.filter((project) => (project.subjectIds || []).includes(subject.id)).length + (subject.linkedProjectIds || []).length,
      subjects: data.subjects.filter((other) => (other.linkedSubjectIds || []).includes(subject.id)).length + (subject.linkedSubjectIds || []).length,
      materials: (subject.materialIds || []).length,
    };
  });
  data.materials.forEach((material) => {
    materialUsage[material.id] = {
      projects: data.projects.filter((project) => (project.materialIds || []).includes(material.id)).length + (material.linkedProjectIds || []).length,
      subjects: data.subjects.filter((subject) => (subject.materialIds || []).includes(material.id)).length + (material.linkedSubjectIds || []).length,
    };
  });
  return { subjects: subjectUsage, materials: materialUsage };
}

function linkNewProject(current, project, tags, context) {
  return linkExistingRecord({ ...current, tags, projects: [project, ...current.projects] }, 'project', project.id, context);
}

function linkNewSubject(current, subject, tags, context) {
  return linkExistingRecord({ ...current, tags, subjects: [subject, ...current.subjects] }, 'subject', subject.id, context);
}

function linkNewMaterial(current, material, tags, context) {
  return linkExistingRecord({ ...current, tags, materials: [material, ...current.materials] }, 'material', material.id, context);
}

function linkExistingRecord(current, kind, id, context) {
  if (!context) return current;
  if (context.type === 'project') {
    return {
      ...current,
      projects: current.projects.map((project) => project.id === context.id ? {
        ...project,
        subjectIds: kind === 'subject' ? unique([...(project.subjectIds || []), id]) : project.subjectIds || [],
        materialIds: kind === 'material' ? unique([...(project.materialIds || []), id]) : project.materialIds || [],
        updatedAt: now(),
      } : project),
      subjects: kind === 'subject' ? current.subjects.map((subject) => subject.id === id ? { ...subject, linkedProjectIds: unique([...(subject.linkedProjectIds || []), context.id]) } : subject) : current.subjects,
      materials: kind === 'material' ? current.materials.map((material) => material.id === id ? { ...material, linkedProjectIds: unique([...(material.linkedProjectIds || []), context.id]) } : material) : current.materials,
    };
  }
  if (context.type === 'subject') {
    return {
      ...current,
      subjects: current.subjects.map((subject) => {
        if (subject.id === context.id) {
          return {
            ...subject,
            linkedSubjectIds: kind === 'subject' ? unique([...(subject.linkedSubjectIds || []), id]).filter((subjectId) => subjectId !== subject.id) : subject.linkedSubjectIds || [],
            materialIds: kind === 'material' ? unique([...(subject.materialIds || []), id]) : subject.materialIds || [],
            updatedAt: now(),
          };
        }
        if (kind === 'subject' && subject.id === id) return { ...subject, linkedSubjectIds: unique([...(subject.linkedSubjectIds || []), context.id]) };
        return subject;
      }),
      materials: kind === 'material' ? current.materials.map((material) => material.id === id ? { ...material, linkedSubjectIds: unique([...(material.linkedSubjectIds || []), context.id]) } : material) : current.materials,
    };
  }
  return current;
}

function NavButton({ label, icon, active, onClick }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{React.cloneElement(icon, { size: 21 })}<span>{label}</span></button>;
}

function Panel({ title, icon, actions, children }) {
  return <section className="panel"><div className="panel-head"><h2>{React.cloneElement(icon, { size: 20 })}{title}</h2>{actions}</div>{children}</section>;
}

function Empty({ text }) {
  return <p className="empty-line">{text}</p>;
}

function Stat({ label, value }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}

function HomeScreen({ setTab, openSettings }) {

  return <section className="screen-stack">
    <div className="hero-panel">
      <div>
        <p className="eyebrow">My study</p>
        <h1>Study Globe</h1>
      </div>
      <div className="home-actions">
        <button className="primary-action" onClick={() => setTab('guided-add')}><CirclePlus /> Add to My Study</button>
        <button className="primary-action calm" onClick={() => setTab('explore')}><Compass /> Explore My Study</button>
        <button className="secondary-action" onClick={() => setTab('search')}><Search /> Search My Study</button>
      </div>
      <div className="secondary-strip">
        <button onClick={openSettings}><Download size={18} /> Backup</button>
        <button onClick={openSettings}><Settings size={18} /> Settings</button>
      </div>
    </div>
  </section>;
}

const ADD_CHOICES = [
  { key: 'Person', label: 'Person', prompt: 'Who would you like to learn more about?', subjectType: 'Person', picture: true },
  { key: 'Place', label: 'Place', prompt: 'What place do you want to add to the map today?', subjectType: 'Place', picture: true },
  { key: 'Quality', label: 'Quality', prompt: 'What quality do you want to understand better?', subjectType: 'Quality' },
  { key: 'Event', label: 'Event', prompt: 'What event do you want to learn about?', subjectType: 'Event', picture: true },
  { key: 'Note', label: 'Note', prompt: 'What note do you want to save?', materialType: 'Note', picture: true },
  { key: 'Picture', label: 'Picture', prompt: 'What picture do you want to save?', materialType: 'Image', picture: true, pictureFirst: true },
  { key: 'Scripture / Reference', label: 'Scripture / Reference', prompt: 'What scripture or reference do you want to remember?', materialType: 'Scripture / Reference' },
  { key: 'Question', label: 'Question', prompt: 'What question do you want to research?', materialType: 'Research Question' },
  { key: 'Study', label: 'Study', prompt: 'What study do you want to start?', project: true },
];

function GuidedAddScreen({ data, refs, createProject, createSubject, createMaterial, setActiveProjectId, setActiveSubjectId, setActiveMaterialId, setTab, onDone }) {
  const [choiceKey, setChoiceKey] = useState('');
  const choice = ADD_CHOICES.find((item) => item.key === choiceKey);

  return <section className="screen-stack">
    <Panel title="Add to My Study" icon={<CirclePlus />}>
      {!choice ? (
        <div className="choice-grid">
          <h3>What would you like to add?</h3>
          {ADD_CHOICES.map((item) => <button key={item.key} className="choice-card" onClick={() => setChoiceKey(item.key)}>{item.label}</button>)}
        </div>
      ) : (
        <GuidedAddForm
          choice={choice}
          data={data}
          refs={refs}
          createProject={createProject}
          createSubject={createSubject}
          createMaterial={createMaterial}
          setActiveProjectId={setActiveProjectId}
          setActiveSubjectId={setActiveSubjectId}
          setActiveMaterialId={setActiveMaterialId}
          setTab={setTab}
          onBack={() => setChoiceKey('')}
          onDone={onDone}
        />
      )}
    </Panel>
  </section>;
}

function GuidedAddForm({ choice, data, refs, createProject, createSubject, createMaterial, setActiveProjectId, setActiveSubjectId, setActiveMaterialId, setTab, onBack }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pictureAbout, setPictureAbout] = useState('');
  const [imageData, setImageData] = useState('');
  const [showPicture, setShowPicture] = useState(choice.pictureFirst || false);
  const [description, setDescription] = useState('');
  const [scriptureRefs, setScriptureRefs] = useState('');
  const [source, setSource] = useState('');
  const [projectIds, setProjectIds] = useState([]);
  const [subjectIds, setSubjectIds] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');

  const readImage = (file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result);
    reader.readAsDataURL(file);
  };

  const save = (event) => {
    event.preventDefault();
    if (!title.trim()) return;

    if (choice.project) {
      const id = createProject({ name: title, description, tags, subjectIds, materialIds: [] });
      setActiveProjectId(id);
      setTab('projects');
      return;
    }

    if (choice.subjectType) {
      const id = createSubject({
        type: choice.subjectType,
        name: title,
        categoryId,
        description,
        tags,
        linkedProjectIds: projectIds,
        linkedSubjectIds: [],
        materialIds: [],
        fields: { notes: body, scriptureRefs },
      });
      if (imageData) {
        createMaterial({
          type: 'Image',
          title: `${title} picture`,
          body: pictureAbout || title,
          imageData,
          source,
          scriptureRefs: '',
          personalTakeaway: '',
          tags: '',
          linkedProjectIds: projectIds,
          linkedSubjectIds: [id],
        }, { type: 'subject', id });
      }
      setActiveSubjectId(id);
      setTab('subjects');
      return;
    }

    const id = createMaterial({
      type: choice.materialType,
      title,
      body: choice.pictureFirst ? pictureAbout : body,
      imageData,
      source,
      scriptureRefs: choice.materialType === 'Scripture / Reference' ? title : scriptureRefs,
      personalTakeaway: '',
      tags,
      linkedProjectIds: projectIds,
      linkedSubjectIds: subjectIds,
    });
    setActiveMaterialId(id);
    setTab('material-detail');
  };

  return <form className="guided-form" onSubmit={save}>
    <button className="text-button" type="button" onClick={onBack}>Change what I am adding</button>
    <label>{choice.prompt}<input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus required /></label>

    {choice.key === 'Picture' && <label>What is this picture about?<textarea value={pictureAbout} onChange={(event) => setPictureAbout(event.target.value)} /></label>}
    {['Note', 'Question'].includes(choice.key) && <label>Details<textarea value={body} onChange={(event) => setBody(event.target.value)} /></label>}
    {choice.key === 'Scripture / Reference' && <label>Why do you want to remember it?<textarea value={body} onChange={(event) => setBody(event.target.value)} /></label>}
    {choice.project && <label>A few words about this study<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>}

    {choice.picture && !showPicture && <button className="secondary-action" type="button" onClick={() => setShowPicture(true)}><ImagePlus /> Add picture</button>}
    {showPicture && <PicturePicker imageData={imageData} readImage={readImage} />}

    <details className="template-box">
      <summary>More Details <ChevronDown size={16} /></summary>
      {!choice.project && <CheckList title="Studies" items={data.projects} selected={projectIds} setSelected={setProjectIds} label={(item) => item.name} />}
      {!choice.project && <CheckList title="Topics" items={data.subjects} selected={subjectIds} setSelected={setSubjectIds} label={(item) => `${item.name} - ${item.type}`} />}
      {choice.subjectType && <label>Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">No category</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}
      {choice.subjectType && <label>Notes<textarea value={body} onChange={(event) => setBody(event.target.value)} /></label>}
      {choice.subjectType && <label>Scripture / references<input value={scriptureRefs} onChange={(event) => setScriptureRefs(event.target.value)} /></label>}
      {!choice.project && <label>Source<input value={source} onChange={(event) => setSource(event.target.value)} /></label>}
      <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
    </details>

    <div className="action-row">
      <button className="secondary-action" type="button" onClick={onBack}>Back</button>
      <button className="primary-action" type="submit"><CirclePlus /> Save</button>
    </div>
  </form>;
}

function PicturePicker({ imageData, readImage }) {
  return <div className="image-dropzone" onPaste={(event) => {
    const file = [...(event.clipboardData?.files || [])].find((entry) => entry.type.startsWith('image/'));
    if (file) {
      event.preventDefault();
      readImage(file);
    }
  }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
    event.preventDefault();
    readImage([...(event.dataTransfer?.files || [])].find((entry) => entry.type.startsWith('image/')));
  }} tabIndex={0}>
    <ImagePlus size={28} />
    <strong>Add picture</strong>
    <input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0])} />
    {imageData && <img className="image-preview" src={imageData} alt="Selected preview" />}
  </div>;
}

function ExploreScreen({ data, refs, usage, setTab, setActiveProjectId, setActiveSubjectId, setActiveMaterialId }) {
  const firstProject = [...data.projects].sort(byRecent)[0];
  const firstPerson = data.subjects.filter((item) => item.type === 'Person').sort(byRecent)[0];
  const firstPlace = data.subjects.filter((item) => item.type === 'Place').sort(byRecent)[0];
  const firstQuality = data.subjects.filter((item) => item.type === 'Quality').sort(byRecent)[0];
  const firstEvent = data.subjects.filter((item) => item.type === 'Event').sort(byRecent)[0];
  const firstNote = data.materials.filter((item) => item.type !== 'Image' && !item.imageData).sort(byRecent)[0];
  const firstPicture = data.materials.filter((item) => item.type === 'Image' || item.imageData).sort(byRecent)[0];

  const entries = [
    firstProject && { label: 'Continue a study', icon: <FolderOpen />, action: () => { setActiveProjectId(firstProject.id); setTab('projects'); } },
    firstPerson && { label: 'Meet someone', icon: <BookOpen />, action: () => { setActiveSubjectId(firstPerson.id); setTab('subjects'); } },
    firstPlace && { label: 'Visit a place', icon: <Compass />, action: () => { setActiveSubjectId(firstPlace.id); setTab('subjects'); } },
    firstQuality && { label: 'Understand a quality', icon: <BookOpen />, action: () => { setActiveSubjectId(firstQuality.id); setTab('subjects'); } },
    firstEvent && { label: 'Learn about an event', icon: <BookOpen />, action: () => { setActiveSubjectId(firstEvent.id); setTab('subjects'); } },
    firstNote && { label: 'Read notes', icon: <FileText />, action: () => { setActiveMaterialId(firstNote.id); setTab('material-detail'); } },
    firstPicture && { label: 'See pictures', icon: <ImagePlus />, action: () => { setActiveMaterialId(firstPicture.id); setTab('material-detail'); } },
    { label: 'Search everything', icon: <Search />, action: () => setTab('search') },
  ].filter(Boolean);

  return <section className="screen-stack">
    <Panel title="Explore My Study" icon={<Compass />}>
      <div className="explore-grid">
        {entries.map((entry) => <button key={entry.label} className="choice-card" onClick={entry.action}>{React.cloneElement(entry.icon, { size: 22 })}<span>{entry.label}</span></button>)}
      </div>
    </Panel>
    {data.projects.length === 0 && data.subjects.length === 0 && data.materials.length === 0 && <Empty text="Add something to your study, then Explore will open more paths." />}
  </section>;
}

function MaterialDetailScreen({ data, refs, usage, activeMaterialId, updateMaterial, deleteMaterial, setTab }) {
  const material = data.materials.find((item) => item.id === activeMaterialId) || data.materials[0];
  return <section className="screen-stack">
    <Panel title="Note" icon={<FileText />} actions={<button className="small-action" onClick={() => setTab('explore')}>Explore</button>}>
      {material ? <MaterialCard material={material} data={data} refs={refs} usage={usage} onUpdate={updateMaterial} onDelete={deleteMaterial} /> : <Empty text="No notes yet." />}
    </Panel>
  </section>;
}

function ProjectsScreen(props) {
  const { data, refs, usage, activeProjectId, setActiveProjectId, openCreate, updateProject, deleteProject, setActiveSubjectId } = props;
  const active = data.projects.find((project) => project.id === activeProjectId) || data.projects[0];
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [active?.id]);

  return <section className="split-layout">
    <aside className="panel list-panel">
      <div className="panel-head"><h2><FolderOpen size={20} />Studies</h2></div>
      <button className="primary-action" onClick={() => openCreate('project')}><CirclePlus /> Start Study</button>
      {data.projects.length ? data.projects.map((project) => <ProjectCard key={project.id} project={project} refs={refs} selected={active?.id === project.id} onOpen={() => setActiveProjectId(project.id)} />) : <Empty text="Start a study." />}
    </aside>
    <section className="panel detail-panel">
      {!active ? <Empty text="Select or start a study." /> : editing ? (
        <ProjectForm data={data} refs={refs} project={active} onSubmit={(values) => { updateProject(active.id, values); setEditing(false); }} onCancel={() => setEditing(false)} />
      ) : (
        <ProjectDetail project={active} data={data} refs={refs} usage={usage} openCreate={openCreate} updateMaterial={props.updateMaterial} deleteMaterial={props.deleteMaterial} onEdit={() => setEditing(true)} onDelete={() => { if (confirm('Delete this study? Topics and notes will remain.')) deleteProject(active.id); }} setActiveSubjectId={setActiveSubjectId} />
      )}
    </section>
  </section>;
}

function ProjectDetail({ project, data, refs, usage, openCreate, updateMaterial, deleteMaterial, onEdit, onDelete, setActiveSubjectId }) {
  const subjects = (project.subjectIds || []).map((id) => refs.subjects[id]).filter(Boolean);
  const materials = (project.materialIds || []).map((id) => refs.materials[id]).filter(Boolean);
  const questions = materials.filter((item) => item.type === 'Research Question');
  const noteMaterials = materials.filter((item) => item.type !== 'Research Question');
  return <>
    <DetailHeader title={project.name} subtitle={`${subjects.length} ${plural('topic', subjects.length)} · ${materials.length} ${plural('note', materials.length)}`} onEdit={onEdit} onDelete={onDelete} />
    <TagRow ids={project.tagIds} refs={refs} />
    <SectionTitle text="Overview" />
    <p className="soft-box">{project.description || 'A place to keep related topics and notes together.'}</p>
    <SectionTitle text="Topics" actions={<button className="small-action" onClick={() => openCreate('subject', { type: 'project', id: project.id })}><CirclePlus size={16} /> Add Topic</button>} />
    {subjects.length ? subjects.map((subject) => <SubjectCard key={subject.id} subject={subject} refs={refs} usage={usage} onOpen={() => setActiveSubjectId(subject.id)} />) : <Empty text="No topics yet." />}
    <SectionTitle text="Notes" actions={<button className="small-action" onClick={() => openCreate('material', { type: 'project', id: project.id })}><CirclePlus size={16} /> Add Note</button>} />
    {noteMaterials.length ? noteMaterials.map((material) => <MaterialCard key={material.id} material={material} data={data} refs={refs} usage={usage} onUpdate={updateMaterial} onDelete={deleteMaterial} />) : <Empty text="No notes yet." />}
    <SectionTitle text="Questions" />
    {questions.length ? questions.map((material) => <MaterialCard key={material.id} material={material} data={data} refs={refs} usage={usage} onUpdate={updateMaterial} onDelete={deleteMaterial} />) : <Empty text="Questions you save will collect here." />}
    <SectionTitle text="Links" />
    <ConnectionList connections={buildConnections(data).filter((item) => item.ids.includes(project.id))} />
  </>;
}

function SubjectsScreen(props) {
  const { data, refs, usage, activeSubjectId, setActiveSubjectId, openCreate, updateSubject, deleteSubject } = props;
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const subjects = data.subjects.filter((subject) => (filter === 'All' || subject.type === filter) && (!query || includes(`${subject.name} ${subject.description}`, query)));
  const active = data.subjects.find((subject) => subject.id === activeSubjectId) || subjects[0] || data.subjects[0];
  useEffect(() => setEditing(false), [active?.id]);

  return <section className="split-layout">
    <aside className="panel list-panel">
      <div className="panel-head"><h2><BookOpen size={20} />Topics</h2></div>
      <button className="primary-action" onClick={() => openCreate('subject')}><CirclePlus /> Add Topic</button>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics" />
      <div className="chip-row"><button className={filter === 'All' ? 'chip active' : 'chip'} onClick={() => setFilter('All')}>All</button>{SUBJECT_TYPES.map((type) => <button key={type} className={filter === type ? 'chip active' : 'chip'} onClick={() => setFilter(type)}>{type}</button>)}</div>
      {subjects.length ? subjects.map((subject) => <SubjectCard key={subject.id} subject={subject} refs={refs} usage={usage} selected={active?.id === subject.id} onOpen={() => setActiveSubjectId(subject.id)} />) : <Empty text="No topics match that filter." />}
    </aside>
    <section className="panel detail-panel">
      {!active ? <Empty text="Select or add a topic." /> : editing ? (
        <SubjectForm data={data} refs={refs} subject={active} usage={usage} onSubmit={(values) => { updateSubject(active.id, values); setEditing(false); }} onCancel={() => setEditing(false)} />
      ) : (
        <SubjectDetail subject={active} data={data} refs={refs} usage={usage} openCreate={openCreate} updateMaterial={props.updateMaterial} deleteMaterial={props.deleteMaterial} onEdit={() => setEditing(true)} onDelete={() => { if (confirm('Delete this topic? Studies and notes will remain.')) deleteSubject(active.id); }} />
      )}
    </section>
  </section>;
}

function SubjectDetail({ subject, data, refs, usage, openCreate, updateMaterial, deleteMaterial, onEdit, onDelete }) {
  const projects = data.projects.filter((project) => (project.subjectIds || []).includes(subject.id) || (subject.linkedProjectIds || []).includes(project.id));
  const linkedSubjects = unique([...(subject.linkedSubjectIds || []), ...data.subjects.filter((other) => (other.linkedSubjectIds || []).includes(subject.id)).map((other) => other.id)])
    .filter((id) => id !== subject.id).map((id) => refs.subjects[id]).filter(Boolean);
  const materials = unique([...(subject.materialIds || []), ...data.materials.filter((material) => (material.linkedSubjectIds || []).includes(subject.id)).map((material) => material.id)])
    .map((id) => refs.materials[id]).filter(Boolean);

  return <>
    <DetailHeader title={subject.name} subtitle={subject.type} badge={subjectUsageLabel(usage.subjects[subject.id])} onEdit={onEdit} onDelete={onDelete} />
    {isSharedSubject(usage.subjects[subject.id]) && <SharedNotice />}
    {subject.description && <p className="description">{subject.description}</p>}
    <TagRow ids={subject.tagIds} refs={refs} />
    <SectionTitle text="Overview" />
    <p className="soft-box">{subject.progressStatus || 'In progress'} - {refs.categories[subject.categoryId]?.name || 'No category'}</p>
    <details className="template-box">
      <summary>Template fields <ChevronDown size={16} /></summary>
      <FieldView fields={subject.fields} />
    </details>
    <SectionTitle text="Used In" />
    {projects.length ? projects.map((project) => <ProjectCard key={project.id} project={project} refs={refs} />) : <Empty text="Not used in a study yet." />}
    <SectionTitle text="Related Topics" actions={<button className="small-action" onClick={() => openCreate('subject', { type: 'subject', id: subject.id })}><CirclePlus size={16} /> Add Topic</button>} />
    {linkedSubjects.length ? linkedSubjects.map((item) => <SubjectCard key={item.id} subject={item} refs={refs} usage={usage} />) : <Empty text="No related topics yet." />}
    <SectionTitle text="Notes" actions={<button className="small-action" onClick={() => openCreate('material', { type: 'subject', id: subject.id })}><CirclePlus size={16} /> Add Note</button>} />
    {materials.length ? materials.map((material) => <MaterialCard key={material.id} material={material} data={data} refs={refs} usage={usage} onUpdate={updateMaterial} onDelete={deleteMaterial} />) : <Empty text="No notes yet." />}
    <SectionTitle text="Links" />
    <ConnectionList connections={buildConnections(data).filter((item) => item.ids.includes(subject.id))} />
  </>;
}

function SearchScreen({ data, refs, usage, setTab, setActiveProjectId, setActiveSubjectId }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => groupedSearch(data, refs, query), [data, refs, query]);
  return <section className="screen-stack">
    <div className="form-card search-card">
      <h2><Search size={22} />Search My Study</h2>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search studies, topics, notes, tags, or scriptures" autoFocus />
    </div>
    {query ? <div className="result-groups">
      <ResultGroup title="Studies" items={results.projects} render={(project) => <ProjectCard project={project} refs={refs} onOpen={() => { setActiveProjectId(project.id); setTab('projects'); }} />} />
      <ResultGroup title="Topics" items={results.subjects} render={(subject) => <SubjectCard subject={subject} refs={refs} usage={usage} onOpen={() => { setActiveSubjectId(subject.id); setTab('subjects'); }} />} />
      <ResultGroup title="Notes" items={results.materials} render={(material) => <MaterialCard material={material} refs={refs} usage={usage} />} />
      <ResultGroup title="Tags" items={results.tags} render={(tagItem) => <div className="plain-card"><Tag size={16} />{tagItem.name}</div>} />
    </div> : <Empty text="Live results appear while you type." />}
  </section>;
}

function groupedSearch(data, refs, query) {
  const tagName = (ids = []) => ids.map((id) => refs.tags[id]?.name).filter(Boolean).join(' ');
  if (!query.trim()) return { projects: [], subjects: [], materials: [], tags: [] };
  return {
    projects: data.projects.filter((project) => includes(`${project.name} ${project.description} ${tagName(project.tagIds)}`, query)),
    subjects: data.subjects.filter((subject) => includes(`${subject.type} ${subject.name} ${subject.description} ${subject.categoryId} ${tagName(subject.tagIds)} ${Object.values(subject.fields || {}).join(' ')}`, query)),
    materials: data.materials.filter((material) => includes(`${material.type} ${material.title} ${material.body} ${material.source} ${material.scriptureRefs} ${material.personalTakeaway} ${tagName(material.tagIds)}`, query)),
    tags: data.tags.filter((tagItem) => includes(tagItem.name, query)),
  };
}

function ResultGroup({ title, items, render }) {
  return <Panel title={`${title} (${items.length})`} icon={<Search />}>{items.length ? items.map((item) => <React.Fragment key={item.id}>{render(item)}</React.Fragment>) : <Empty text={`No ${title.toLowerCase()} found.`} />}</Panel>;
}

function ConnectionsScreen({ data }) {
  const connections = buildConnections(data);
  return <section className="screen-stack">
    <Panel title="Links" icon={<Link2 />}>
      {connections.length ? <ConnectionList connections={connections} /> : <Empty text="Links between studies, topics, notes, tags, and scriptures will appear here." />}
    </Panel>
  </section>;
}

function buildConnections(data) {
  const refs = makeRefs(data);
  const list = [];
  data.projects.forEach((project) => {
    (project.subjectIds || []).forEach((subjectId) => refs.subjects[subjectId] && list.push({ type: 'Study link', ids: [project.id, subjectId], title: `${project.name} - ${refs.subjects[subjectId].name}` }));
    (project.materialIds || []).forEach((materialId) => refs.materials[materialId] && list.push({ type: 'Note link', ids: [project.id, materialId], title: `${project.name} - ${titleOf(refs.materials[materialId])}` }));
  });
  data.subjects.forEach((subject) => {
    (subject.linkedSubjectIds || []).forEach((subjectId) => refs.subjects[subjectId] && list.push({ type: 'Related topic', ids: [subject.id, subjectId], title: `${subject.name} - ${refs.subjects[subjectId].name}` }));
    (subject.materialIds || []).forEach((materialId) => refs.materials[materialId] && list.push({ type: 'Note link', ids: [subject.id, materialId], title: `${subject.name} - ${titleOf(refs.materials[materialId])}` }));
  });
  data.tags.forEach((tagItem) => {
    const holders = [
      ...data.projects.filter((item) => (item.tagIds || []).includes(tagItem.id)).map((item) => item.name),
      ...data.subjects.filter((item) => (item.tagIds || []).includes(tagItem.id)).map((item) => item.name),
      ...data.materials.filter((item) => (item.tagIds || []).includes(tagItem.id)).map(titleOf),
    ];
    if (holders.length > 1) list.push({ type: 'Shared tag', ids: [], title: tagItem.name, detail: holders.join(', ') });
  });
  const scriptureGroups = {};
  data.materials.forEach((material) => {
    if (!material.scriptureRefs) return;
    material.scriptureRefs.split(',').map((ref) => ref.trim()).filter(Boolean).forEach((ref) => {
      scriptureGroups[norm(ref)] = scriptureGroups[norm(ref)] || { label: ref, materials: [] };
      scriptureGroups[norm(ref)].materials.push(material);
    });
  });
  Object.values(scriptureGroups).filter((group) => group.materials.length > 1).forEach((group) => {
    list.push({ type: 'Shared scripture/reference', ids: group.materials.map((item) => item.id), title: group.label, detail: group.materials.map(titleOf).join(', ') });
  });
  return list;
}

function ConnectionList({ connections }) {
  if (!connections.length) return <Empty text="No links yet." />;
  return <div className="connection-list">{connections.map((item, index) => <article className="connection-card" key={`${item.type}-${item.title}-${index}`}><strong>{item.title}</strong><span>{item.type}</span>{item.detail && <p>{item.detail}</p>}</article>)}</div>;
}

function ProjectForm({ data, refs, project, onSubmit, onCancel }) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [tags, setTags] = useState(tagText(project?.tagIds, refs));
  const [subjectIds, setSubjectIds] = useState(project?.subjectIds || []);
  const [materialIds, setMaterialIds] = useState(project?.materialIds || []);
  return <form className="form-card" onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; onSubmit({ name, description, tags, subjectIds, materialIds }); }}>
    <h2><FolderOpen size={22} />{project ? 'Edit Study' : 'Start Study'}</h2>
    <label>Study name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: First-century travel" required /></label>
    <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <CheckList title="Topics" items={data.subjects} selected={subjectIds} setSelected={setSubjectIds} label={(item) => `${item.name} - ${item.type}`} />
    <CheckList title="Notes" items={data.materials} selected={materialIds} setSelected={setMaterialIds} label={titleOf} />
    <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="travel, maps, context" /></label>
    <FormActions onCancel={onCancel} submit={project ? 'Save Study' : 'Start Study'} />
  </form>;
}

function SubjectCreateFlow({ data, refs, usage, onCreate, onLink, context, onCancel }) {
  const [type, setType] = useState(SUBJECT_TYPES[0]);
  const [name, setName] = useState('');
  const matches = data.subjects.filter((subject) => subject.type === type && name.trim() && includes(subject.name, name)).slice(0, 6);
  return <section className="screen-stack">
    <div className="form-card">
      <h2><BookOpen size={22} />Add Topic</h2>
      <label>Topic type<select value={type} onChange={(event) => setType(event.target.value)}>{SUBJECT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Topic name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Type a name, like Peter or Petra" autoFocus /></label>
      {matches.length > 0 && <div className="match-list">{matches.map((subject) => <button type="button" key={subject.id} onClick={() => { onLink('subject', subject.id, context); onCancel(); }}><strong>{subject.name}</strong><small>{subject.type} - {subjectUsageLabel(usage.subjects[subject.id])}</small></button>)}</div>}
    </div>
    <SubjectForm data={data} refs={refs} usage={usage} subject={{ type, name }} onSubmit={(values) => { onCreate(values, context); onCancel(); }} onCancel={onCancel} submitText="Create Topic" />
  </section>;
}

function SubjectForm({ data, refs, subject = {}, usage, onSubmit, onCancel, submitText = 'Save Topic' }) {
  const [type, setType] = useState(subject.type || SUBJECT_TYPES[0]);
  const [name, setName] = useState(subject.name || '');
  const [categoryId, setCategoryId] = useState(subject.categoryId || '');
  const [description, setDescription] = useState(subject.description || '');
  const [tags, setTags] = useState(tagText(subject.tagIds, refs));
  const [linkedProjectIds, setLinkedProjectIds] = useState(subject.linkedProjectIds || []);
  const [linkedSubjectIds, setLinkedSubjectIds] = useState(subject.linkedSubjectIds || []);
  const [materialIds, setMaterialIds] = useState(subject.materialIds || []);
  const [progressStatus, setProgressStatus] = useState(subject.progressStatus || '');
  const [fields, setFields] = useState({
    summary: subject.fields?.summary || '',
    location: subject.fields?.location || '',
    dates: subject.fields?.dates || '',
    scriptureRefs: subject.fields?.scriptureRefs || '',
    questions: subject.fields?.questions || '',
    notes: subject.fields?.notes || '',
  });
  const shared = subject.id && isSharedSubject(usage.subjects[subject.id]);
  return <form className="form-card" onSubmit={(event) => { event.preventDefault(); if (!type || !name.trim()) return; onSubmit({ type, name, categoryId, description, tags, linkedProjectIds, linkedSubjectIds, materialIds, fields, progressStatus }); }}>
    <h2><BookOpen size={22} />{subject.id ? 'Edit Topic' : 'Create Topic'}</h2>
    {shared && <SharedNotice />}
    <label>Type<select value={type} onChange={(event) => setType(event.target.value)}>{SUBJECT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
    <details className="template-box" open={false}>
      <summary>Optional template fields <ChevronDown size={16} /></summary>
      <label>Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">No category</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label>Summary<input value={fields.summary} onChange={(event) => setFields({ ...fields, summary: event.target.value })} /></label>
      <label>Location<input value={fields.location} onChange={(event) => setFields({ ...fields, location: event.target.value })} /></label>
      <label>Dates / time period<input value={fields.dates} onChange={(event) => setFields({ ...fields, dates: event.target.value })} /></label>
      <label>Scripture / reference fields<input value={fields.scriptureRefs} onChange={(event) => setFields({ ...fields, scriptureRefs: event.target.value })} /></label>
      <label>Questions<textarea value={fields.questions} onChange={(event) => setFields({ ...fields, questions: event.target.value })} /></label>
      <label>Notes<textarea value={fields.notes} onChange={(event) => setFields({ ...fields, notes: event.target.value })} /></label>
      <label>Progress<select value={progressStatus} onChange={(event) => setProgressStatus(event.target.value)}><option value="">In progress</option><option>Not Started</option><option>More Research Needed</option><option>Partly Supported</option><option>Well Developed</option></select></label>
      <CheckList title="Used In" items={data.projects} selected={linkedProjectIds} setSelected={setLinkedProjectIds} label={(item) => item.name} />
      <CheckList title="Related Topics" items={data.subjects.filter((item) => item.id !== subject.id)} selected={linkedSubjectIds} setSelected={setLinkedSubjectIds} label={(item) => `${item.name} - ${item.type}`} />
      <CheckList title="Notes" items={data.materials} selected={materialIds} setSelected={setMaterialIds} label={titleOf} />
      <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="faith, family, geography" /></label>
    </details>
    <FormActions onCancel={onCancel} submit={submitText} />
  </form>;
}

function MaterialFinder({ data, refs, usage, onCreate, onLink, context, onCancel }) {
  const [query, setQuery] = useState('');
  const matches = data.materials.filter((material) => query.trim() && includes(`${material.title} ${material.body} ${material.scriptureRefs}`, query)).slice(0, 6);
  return <section className="screen-stack">
    <div className="form-card">
      <h2><FileText size={22} />Add Note</h2>
      <label>Find existing note<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, note text, or scripture" autoFocus /></label>
      {matches.length > 0 && <div className="match-list">{matches.map((material) => <button type="button" key={material.id} onClick={() => { onLink('material', material.id, context); onCancel(); }}><strong>{titleOf(material)}</strong><small>{material.type} - {materialUsageLabel(usage.materials[material.id])}</small></button>)}</div>}
    </div>
    <MaterialForm data={data} refs={refs} usage={usage} onSubmit={(values) => { onCreate(values, context); onCancel(); }} onCancel={onCancel} submitText="Create Note" />
  </section>;
}

function MaterialForm({ data, refs, usage, material = {}, onSubmit, onCancel, submitText = 'Save Note' }) {
  const [type, setType] = useState(material.type || 'Note');
  const [title, setTitle] = useState(material.title || '');
  const [body, setBody] = useState(material.body || '');
  const [imageData, setImageData] = useState(material.imageData || '');
  const [source, setSource] = useState(material.source || '');
  const [scriptureRefs, setScriptureRefs] = useState(material.scriptureRefs || '');
  const [personalTakeaway, setPersonalTakeaway] = useState(material.personalTakeaway || '');
  const [tags, setTags] = useState(tagText(material.tagIds, refs));
  const [linkedProjectIds, setLinkedProjectIds] = useState(material.linkedProjectIds || []);
  const [linkedSubjectIds, setLinkedSubjectIds] = useState(material.linkedSubjectIds || []);
  const shared = material.id && isSharedMaterial(usage.materials[material.id]);
  const readImage = (file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result);
    reader.readAsDataURL(file);
  };
  return <form className="form-card" onSubmit={(event) => { event.preventDefault(); if (!title.trim()) return; onSubmit({ type, title, body, imageData, source, scriptureRefs, personalTakeaway, tags, linkedProjectIds, linkedSubjectIds }); }}>
    <h2><FileText size={22} />{material.id ? 'Edit Note' : 'Create Note'}</h2>
    {shared && <SharedNotice />}
    <label>Note type<select value={type} onChange={(event) => setType(event.target.value)}>{MATERIAL_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
    {type === 'Image' && <label>Image<div className="image-dropzone" onPaste={(event) => { const file = [...(event.clipboardData?.files || [])].find((entry) => entry.type.startsWith('image/')); if (file) { event.preventDefault(); readImage(file); } }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); readImage([...(event.dataTransfer?.files || [])].find((entry) => entry.type.startsWith('image/'))); }} tabIndex={0}>
      <ImagePlus size={28} /><strong>Paste, drop, or choose an image</strong><input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0])} />{imageData && <img className="image-preview" src={imageData} alt="Selected preview" />}
    </div></label>}
    <label>{type === 'Research Question' ? 'Question / details' : 'Body'}<textarea value={body} onChange={(event) => setBody(event.target.value)} /></label>
    <details className="template-box">
      <summary>Optional fields <ChevronDown size={16} /></summary>
      <label>Scripture / references<input value={scriptureRefs} onChange={(event) => setScriptureRefs(event.target.value)} placeholder="James 1:2-4, Hebrews 11" /></label>
      <label>Personal takeaway<textarea value={personalTakeaway} onChange={(event) => setPersonalTakeaway(event.target.value)} /></label>
      <label>Source<input value={source} onChange={(event) => setSource(event.target.value)} /></label>
      <CheckList title="Used In" items={data.projects} selected={linkedProjectIds} setSelected={setLinkedProjectIds} label={(item) => item.name} />
      <CheckList title="Topics" items={data.subjects} selected={linkedSubjectIds} setSelected={setLinkedSubjectIds} label={(item) => `${item.name} - ${item.type}`} />
      <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
    </details>
    <FormActions onCancel={onCancel} submit={submitText} />
  </form>;
}

function CheckList({ title, items, selected, setSelected, label }) {
  if (!items.length) return null;
  return <fieldset className="check-list"><legend>{title}</legend>{items.map((item) => <label key={item.id} className="check-row"><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? unique([...selected, item.id]) : selected.filter((id) => id !== item.id))} />{label(item)}</label>)}</fieldset>;
}

function FormActions({ onCancel, submit }) {
  return <div className="action-row"><button className="secondary-action" type="button" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit"><CirclePlus />{submit}</button></div>;
}

function DetailHeader({ title, subtitle, badge, onEdit, onDelete }) {
  return <div className="detail-head"><div><h2>{title}</h2><p>{subtitle}</p>{badge && <span className="usage-badge">{badge}</span>}</div><div className="card-actions"><button className="icon-button neutral" onClick={onEdit} title="Edit"><Pencil size={18} /></button><button className="icon-button danger-icon" onClick={onDelete} title="Delete"><Trash2 size={18} /></button></div></div>;
}

function SectionTitle({ text, actions }) {
  return <div className="section-title"><h3>{text}</h3>{actions}</div>;
}

function ProjectCard({ project, refs, selected, onOpen }) {
  const topicCount = (project.subjectIds || []).length;
  const noteCount = (project.materialIds || []).length;
  const content = <><div><strong>{project.name}</strong><small>{topicCount} {plural('topic', topicCount)} · {noteCount} {plural('note', noteCount)}</small></div><TagRow ids={project.tagIds} refs={refs} compact /></>;
  return onOpen ? <button className={`entity-card ${selected ? 'selected' : ''}`} onClick={onOpen}>{content}</button> : <article className="entity-card">{content}</article>;
}

function SubjectCard({ subject, refs, usage, selected, onOpen }) {
  const content = <><div><strong>{subject.name}</strong><small>{subject.type} - {subjectUsageLabel(usage.subjects[subject.id])}</small></div><TagRow ids={subject.tagIds} refs={refs} compact /></>;
  return onOpen ? <button className={`entity-card ${selected ? 'selected' : ''}`} onClick={onOpen}>{content}</button> : <article className="entity-card">{content}</article>;
}

function MaterialCard({ material, data, refs, usage, onOpen, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return <MaterialForm
      data={data}
      refs={refs}
      usage={usage}
      material={material}
      onSubmit={(values) => {
        onUpdate(material.id, values);
        setEditing(false);
      }}
      onCancel={() => setEditing(false)}
    />;
  }
  const content = <>
    <div className="card-title-row">
      <div><strong>{titleOf(material)}</strong><small>{material.type} - {materialUsageLabel(usage.materials[material.id])}</small></div>
      {onUpdate && <div className="card-actions">
        <button className="icon-button neutral" onClick={() => setEditing(true)} title="Edit"><Pencil size={18} /></button>
        <button className="icon-button danger-icon" onClick={() => { if (confirm('Delete this note? It will be removed from any studies or topics using it.')) onDelete(material.id); }} title="Delete"><Trash2 size={18} /></button>
      </div>}
    </div>
    {material.imageData && <img className="saved-image" src={material.imageData} alt={titleOf(material)} />}
    {material.body && <p>{material.body}</p>}
    {material.scriptureRefs && <p className="meta"><strong>References:</strong> {material.scriptureRefs}</p>}
    <TagRow ids={material.tagIds} refs={refs} compact />
  </>;
  if (onOpen) return <button className="entity-card" onClick={onOpen}>{content}</button>;
  return <article className="entity-card">{content}</article>;
}

function FieldView({ fields = {} }) {
  const entries = Object.entries(fields).filter(([, value]) => String(value || '').trim());
  return entries.length ? <div className="field-view">{entries.map(([key, value]) => <p key={key}><strong>{key.replace(/([A-Z])/g, ' $1')}:</strong> {value}</p>)}</div> : <Empty text="No optional fields filled in yet." />;
}

function TagRow({ ids = [], refs, compact = false }) {
  const tags = ids.map((id) => refs.tags[id]).filter(Boolean);
  if (!tags.length) return null;
  return <div className={`tag-row ${compact ? 'compact' : ''}`}>{tags.map((tagItem) => <span key={tagItem.id}><Tag size={13} />{tagItem.name}</span>)}</div>;
}

function SharedNotice() {
  return <p className="shared-notice">Changes update everywhere this is used.</p>;
}

function subjectUsageLabel(usage = {}) {
  const total = (usage.projects || 0) + (usage.subjects || 0) + (usage.materials || 0);
  if (usage.projects) return `Used in ${usage.projects} ${plural('study', usage.projects)}`;
  if (usage.subjects) return `${usage.subjects} related ${plural('topic', usage.subjects)}`;
  return `Used in ${total || 1} place${total === 1 ? '' : 's'}`;
}

function materialUsageLabel(usage = {}) {
  const total = (usage.projects || 0) + (usage.subjects || 0);
  if (usage.projects) return `Used in ${usage.projects} ${plural('study', usage.projects)}`;
  if (usage.subjects) return `Used with ${usage.subjects} ${plural('topic', usage.subjects)}`;
  return `Used in ${total || 1} place${total === 1 ? '' : 's'}`;
}

function isSharedSubject(usage = {}) {
  return (usage.projects || 0) + (usage.subjects || 0) > 1;
}

function isSharedMaterial(usage = {}) {
  return (usage.projects || 0) + (usage.subjects || 0) > 1;
}

function tagText(ids = [], refs) {
  return ids.map((id) => refs?.tags?.[id]?.name).filter(Boolean).join(', ');
}

function SettingsPanel({ data, setData, addCategory, renameCategory, deleteCategory, renameTag, deleteTag, onClose }) {
  const [newCategory, setNewCategory] = useState('');
  const fileRef = useRef(null);
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `study-globe-v2-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const restoreBackup = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setData(migrateData(JSON.parse(reader.result)));
      } catch {
        alert('That backup file could not be read.');
      }
    };
    reader.readAsText(file);
  };
  const clearData = () => {
    if (!confirm('Clear all local Study Globe data on this device?')) return;
    setData(seedData());
  };
  return <div className="modal-backdrop">
    <section className="settings-panel">
      <div className="panel-head"><h2><Settings size={22} />Settings</h2><button className="icon-button" onClick={onClose} title="Close"><X size={18} /></button></div>
      <Panel title="Manage Categories" icon={<Boxes />}>
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); addCategory(newCategory); setNewCategory(''); }}><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Find or create category" /><button>Add</button></form>
        <ManageRows items={data.categories} onRename={renameCategory} onDelete={deleteCategory} deleteText="Delete this category?" />
      </Panel>
      <Panel title="Manage Tags" icon={<Tag />}>
        <ManageRows items={data.tags} onRename={renameTag} onDelete={deleteTag} deleteText="Delete this tag everywhere?" empty="No tags yet." />
      </Panel>
      <Panel title="Backup / Restore" icon={<Download />}>
        <button className="secondary-action" onClick={exportBackup}><Download /> Export backup</button>
        <button className="secondary-action" onClick={() => fileRef.current?.click()}><Upload /> Restore backup</button>
        <input ref={fileRef} hidden type="file" accept="application/json" onChange={(event) => restoreBackup(event.target.files?.[0])} />
        <button className="danger" onClick={clearData}><Trash2 size={17} /> Clear local data</button>
      </Panel>
      <Panel title="App Info" icon={<Compass />}>
        <p className="helper">Study Globe v2. Local storage only. No SQL, sync, login, imports, OCR, AI tagging, media import, or globe animation.</p>
      </Panel>
    </section>
  </div>;
}

function ManageRows({ items, onRename, onDelete, deleteText, empty = 'Nothing here yet.' }) {
  if (!items.length) return <Empty text={empty} />;
  return <div className="manage-list">{items.map((item) => <ManageRow key={item.id} item={item} onRename={onRename} onDelete={onDelete} deleteText={deleteText} />)}</div>;
}

function ManageRow({ item, onRename, onDelete, deleteText }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  return <div className="manage-row">{editing ? <input value={name} onChange={(event) => setName(event.target.value)} /> : <span>{item.name}</span>}<div>{editing ? <button onClick={() => { onRename(item.id, name); setEditing(false); }}>Save</button> : <button onClick={() => setEditing(true)}>Rename</button>}<button className="danger small" onClick={() => { if (confirm(deleteText)) onDelete(item.id); }}>Delete</button></div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
