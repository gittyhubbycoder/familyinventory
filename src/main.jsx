import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Search, Plus, Boxes, MapPin, LogOut, Pencil, Trash2, X, Package, RefreshCw, AlertCircle, Check, ChevronDown } from 'lucide-react';
import './style.css';

// `||` rather than `&&`: an empty string must not be treated as "configured".
// Trailing slashes break some Supabase endpoints, so they are stripped.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const configProblem = !supabaseUrl
  ? 'VITE_SUPABASE_URL is missing.'
  : !supabaseKey
    ? 'VITE_SUPABASE_PUBLISHABLE_KEY is missing.'
    : '';
const configTable = import.meta.env.VITE_INVENTORY_TABLE || 'inventory';

// Turns the terse PostgREST/Auth failures into something a non-developer can act on.
function explainError(error) {
  if (!error) return '';
  const message = error.message || String(error);
  const code = error.code || '';
  if (code === '42P01' || /relation .* does not exist/i.test(message)) {
    return `The "${configTable}" table does not exist in this Supabase project. Check that VITE_SUPABASE_URL points at the right project.`;
  }
  if (code === '42501' || /permission denied/i.test(message)) {
    return 'Permission denied. The table grants or Row Level Security policies for signed-in users are missing — run the SQL in the README ("1. Configure the database permissions").';
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return `Could not reach Supabase at ${supabaseUrl || '(no URL set)'}. Check your internet connection, and check that VITE_SUPABASE_URL is the Project URL from Supabase → Project Settings → API Keys.`;
  }
  if (/invalid api key|no api key|apikey/i.test(message)) {
    return 'Supabase rejected the API key. VITE_SUPABASE_PUBLISHABLE_KEY must be the Publishable key (sb_publishable_…) from Supabase → Project Settings → API Keys, not the secret/service_role key.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Wrong email or password. Accounts are created in Supabase → Authentication → Users.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'This account’s email has not been confirmed yet. Ask the owner to confirm it in Supabase → Authentication → Users.';
  }
  return message;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) setError(explainError(error)); else onLogin(); } catch (err) { setError(explainError(err)); } finally { setBusy(false); } }
  return <main className="login-wrap"><form className="login-card" onSubmit={submit}>
    <div className="brand-mark"><Boxes size={27}/></div><p className="eyebrow">SHARED FAMILY SPACE</p><h1>Family Inventory</h1><p className="muted intro">Sign in to view and manage your household inventory.</p>
    <label>Email address<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required /></label>
    <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required /></label>
    {error && <div className="error"><AlertCircle size={16}/>{error}</div>}
    <button className="primary full" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    <p className="login-foot">Accounts are created by the inventory owner. Contact them if you need access.</p>
  </form></main>
}

function ItemModal({ item, locations, onClose, onSave }) {
  const [form, setForm] = useState(item || { name:'', class:'', tags:'', location:'', qty:1 });
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const set=(key,value)=>setForm(old=>({...old,[key]:value}));
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const result=await onSave({...form,name:form.name.trim(),itemClass:form.class.trim(),tags:form.tags.trim(),location:form.location.trim(),qty:Number(form.qty)});if(result?.error)setError(result.error);else onClose();}catch(err){setError(explainError(err));}finally{setBusy(false);}}
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><form className="modal" onSubmit={submit}>
    <div className="modal-head"><div><p className="eyebrow">INVENTORY ITEM</p><h2>{item?'Edit item':'Add an item'}</h2></div><button type="button" className="icon-btn" onClick={onClose}><X/></button></div>
    <label>Item name<input autoFocus value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. 220Ω resistor" required maxLength="120"/></label>
    <div className="form-grid"><label>Category<input value={form.class} onChange={e=>set('class',e.target.value)} placeholder="e.g. Resistors" required maxLength="80"/></label><label>Quantity<input type="number" min="0" step="1" value={form.qty} onChange={e=>set('qty',e.target.value)} required/></label></div>
    <label>Location<div className="select-wrap"><select value={form.location} onChange={e=>set('location',e.target.value)}><option value="">Choose a location</option>{locations.map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown size={17}/></div></label>
    <label>Tags <span className="optional">(optional)</span><input value={form.tags} onChange={e=>set('tags',e.target.value)} placeholder="e.g. through-hole, 1/4W"/></label>
    {error&&<div className="error"><AlertCircle size={16}/>{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':item?'Save changes':'Add item'}</button></div>
  </form></div>
}

function App(){
  const [session,setSession]=useState(null); const [loading,setLoading]=useState(true); const [items,setItems]=useState([]); const [fetching,setFetching]=useState(false);
  const [search,setSearch]=useState(''); const [category,setCategory]=useState('All categories'); const [location,setLocation]=useState('All locations');
  const [modal,setModal]=useState(null); const [notice,setNotice]=useState(''); const [error,setError]=useState('');
  useEffect(()=>{ if(!supabase){setLoading(false);return;} supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false);}).catch(()=>setLoading(false)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s)); return()=>subscription.unsubscribe(); },[]);
  async function loadItems(){if(!supabase)return;setFetching(true);setError('');try{const {data,error}=await supabase.from(configTable).select('id,name,class,tags,location,qty,synced,updated_at').order('name');if(error)setError(explainError(error));else setItems(data||[]);}catch(err){setError(explainError(err));}finally{setFetching(false);}}
  useEffect(()=>{if(session)loadItems();},[session]);
  const categories=useMemo(()=>['All categories',...new Set(items.map(x=>x.class).filter(Boolean).sort())],[items]);
  const locations=useMemo(()=>[...new Set(items.map(x=>x.location).filter(Boolean).sort())],[items]);
  const filtered=useMemo(()=>items.filter(x=>{const q=search.toLowerCase();const match=!q||[x.name,x.class,x.tags,x.location].some(v=>(v||'').toLowerCase().includes(q));return match&&(category==='All categories'||x.class===category)&&(location==='All locations'||x.location===location);}),[items,search,category,location]);
  const total=items.reduce((n,x)=>n+(Number(x.qty)||0),0);
  async function saveItem(form){
    const payload={name:form.name,class:form.itemClass,tags:form.tags,location:form.location,qty:form.qty,synced:true,updated_at:new Date().toISOString()};
    let result;
    try{
      if(form.id){result=await supabase.from(configTable).update(payload).eq('id',form.id);}
      else{
        // "max(id)+1" raced between two people and failed on the primary key.
        // Let the database assign the id when it owns the column; only fall back
        // to computing one if the column is a manually-managed integer.
        result=await supabase.from(configTable).insert(payload);
        if(result.error&&/null value in column "id"|not-null/i.test(result.error.message||'')){
          const nextId=items.reduce((m,x)=>Math.max(m,Number(x.id)||0),0)+1;
          result=await supabase.from(configTable).insert({...payload,id:nextId});
        }
      }
    }catch(err){return {error:explainError(err)};}
    if(result.error)return {error:explainError(result.error)};
    await loadItems();setNotice(form.id?'Item updated':'Item added');return {};
  }
  async function deleteItem(item){if(!window.confirm(`Delete “${item.name}”? This cannot be undone.`))return;try{const {error}=await supabase.from(configTable).delete().eq('id',item.id);if(error)setError(explainError(error));else{await loadItems();setNotice('Item deleted');}}catch(err){setError(explainError(err));}}
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),2800);return()=>clearTimeout(t)},[notice]);
  if(!supabase)return <div className="setup-screen"><div className="setup-card"><AlertCircle size={30}/><h1>Configuration needed</h1><p><code>{configProblem}</code></p><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to your <code>.env</code> file when running locally, or to the build environment when deploying. See the README.</p></div></div>;
  if(loading)return <div className="loading">Loading your inventory…</div>;
  if(!session)return <Login onLogin={()=>supabase.auth.getSession().then(({data})=>setSession(data.session))}/>;
  return <div className="app-shell"><aside className="sidebar"><div className="side-brand"><div className="brand-mark small"><Boxes size={21}/></div><div><b>Family Inventory</b><span>Shared workspace</span></div></div><div className="side-label">WORKSPACE</div><div className="nav-active"><Package size={18}/> Inventory <span>{items.length}</span></div><div className="side-bottom"><div className="user-chip"><div className="avatar">{(session.user.email||'U')[0].toUpperCase()}</div><div className="user-info"><b>{session.user.email}</b><span>Signed in</span></div><button className="icon-btn logout" title="Sign out" onClick={()=>supabase.auth.signOut()}><LogOut size={17}/></button></div></div></aside>
  <main className="main"><header className="topbar"><div><p className="eyebrow">YOUR HOUSEHOLD</p><h1>Inventory</h1></div><div className="top-actions"><span className="live-dot">Live database</span><button className="primary" onClick={()=>setModal({})}><Plus size={18}/> Add item</button></div></header>
  <section className="welcome"><div><h2>Everything in its place.</h2><p>Keep track of your components, supplies and where they live.</p></div><div className="welcome-icon"><Boxes size={37}/></div></section>
  <section className="stats"><div className="stat-card"><div className="stat-icon blue"><Package/></div><div><span>Total item types</span><b>{items.length}</b></div></div><div className="stat-card"><div className="stat-icon purple"><Boxes/></div><div><span>Total quantity</span><b>{total.toLocaleString()}</b></div></div><div className="stat-card"><div className="stat-icon orange"><MapPin/></div><div><span>Locations</span><b>{locations.length}</b></div></div></section>
  <section className="inventory-panel"><div className="panel-head"><div><h2>All items</h2><p>{filtered.length} {filtered.length===1?'result':'results'}</p></div><button className="refresh-btn" onClick={loadItems} disabled={fetching}><RefreshCw size={16} className={fetching?'spin':''}/> Refresh</button></div>
  <div className="filters"><div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search names, tags, categories…"/></div><div className="select-wrap filter-select"><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={16}/></div><div className="select-wrap filter-select"><select value={location} onChange={e=>setLocation(e.target.value)}><option>All locations</option>{locations.map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={16}/></div></div>
  {error&&<div className="error page-error"><AlertCircle size={16}/>{error}</div>}
  <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>CATEGORY</th><th>LOCATION</th><th>QUANTITY</th><th></th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><div className="item-name"><div className="item-icon"><Package size={17}/></div><div><b>{item.name}</b>{item.tags&&<span>{item.tags}</span>}</div></div></td><td><span className="category-pill">{item.class||'Uncategorised'}</span></td><td><span className="location-cell">{item.location||'—'}</span></td><td><b className="quantity">{item.qty}</b></td><td><div className="row-actions"><button className="icon-btn" title="Edit item" onClick={()=>setModal(item)}><Pencil size={16}/></button><button className="icon-btn danger-hover" title="Delete item" onClick={()=>deleteItem(item)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>
  {!filtered.length&&<div className="empty"><div className="empty-icon"><Package size={27}/></div><h3>{items.length?'No matching items':'Your inventory is empty'}</h3><p>{items.length?'Try another search or change your filters.':'Add your first item to get started.'}</p>{!items.length&&<button className="primary" onClick={()=>setModal({})}><Plus size={17}/> Add first item</button>}</div>}</div></section>
  <footer>Changes are saved to your shared database automatically.</footer></main>
  {notice&&<div className="toast"><Check size={17}/>{notice}</div>}{modal&&<ItemModal item={modal.id?modal:null} locations={locations} onClose={()=>setModal(null)} onSave={saveItem}/>}
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
