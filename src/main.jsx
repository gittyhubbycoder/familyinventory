import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Boxes, Package, Search, Plus, Pencil, Trash2, LogOut, MapPin, RefreshCw, X, AlertCircle } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createClient(url, key) : null;

function Login({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message); else onSignedIn();
  }
  return <main className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="brand-icon"><Boxes size={28}/></div>
    <p className="eyebrow">SHARED FAMILY SPACE</p><h1>Family Inventory</h1>
    <p className="muted">Sign in to view and manage your household inventory.</p>
    <label>Email address<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required /></label>
    <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required /></label>
    {error && <p className="error"><AlertCircle size={16}/>{error}</p>}
    <button className="primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p className="hint">Accounts are created by the inventory owner. Ask them if you need access.</p>
  </form></main>;
}

function ItemDialog({ item, locations, onClose, onSave }) {
  const [form, setForm] = useState(item || { name:'', class:'', tags:'', location:'', qty:1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (k,v) => setForm(old => ({...old,[k]:v}));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    const result = await onSave({...form, name:form.name.trim(), itemClass:form.class.trim(), tags:form.tags.trim(), location:form.location.trim(), qty:Number(form.qty)});
    setBusy(false); if (result?.error) setError(result.error); else onClose();
  }
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <form className="dialog" onSubmit={submit}>
      <div className="dialog-head"><div><p className="eyebrow">INVENTORY ITEM</p><h2>{item ? 'Edit item' : 'Add an item'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X/></button></div>
      <label>Item name<input autoFocus value={form.name} onChange={e=>change('name',e.target.value)} placeholder="e.g. 220Ω resistor" maxLength="120" required /></label>
      <div className="two-col"><label>Category<input value={form.class} onChange={e=>change('class',e.target.value)} placeholder="e.g. Resistors" maxLength="80" required /></label><label>Quantity<input type="number" min="0" step="1" value={form.qty} onChange={e=>change('qty',e.target.value)} required /></label></div>
      <label>Location<select value={form.location} onChange={e=>change('location',e.target.value)}><option value="">Choose a location</option>{locations.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Tags <span className="muted">(optional)</span><input value={form.tags} onChange={e=>change('tags',e.target.value)} placeholder="e.g. through-hole, 1/4W" /></label>
      {error && <p className="error"><AlertCircle size={16}/>{error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':item?'Save changes':'Add item'}</button></div>
    </form>
  </div>;
}

function App() {
  const [session,setSession] = useState(null);
  const [ready,setReady] = useState(false);
  const [items,setItems] = useState([]);
  const [busy,setBusy] = useState(false);
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('All categories');
  const [location,setLocation] = useState('All locations');
  const [dialog,setDialog] = useState(null);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');

  useEffect(() => {
    if (!db) { setReady(true); return; }
    db.auth.getSession().then(({data})=>{setSession(data.session);setReady(true);});
    const {data:{subscription}} = db.auth.onAuthStateChange((_event,s)=>setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  async function refresh() {
    if (!db) return;
    setBusy(true); setError('');
    const {data,error} = await db.from('inventory').select('id,name,class,tags,location,qty,synced,updated_at').order('name');
    if (error) setError(error.message); else setItems(data || []);
    setBusy(false);
  }
  useEffect(()=>{if(session) refresh();},[session]);

  const categories = useMemo(()=>['All categories',...new Set(items.map(x=>x.class).filter(Boolean).sort())],[items]);
  const locations = useMemo(()=>[...new Set(items.map(x=>x.location).filter(Boolean).sort())],[items]);
  const shown = useMemo(()=>items.filter(x=>{
    const q=search.toLowerCase();
    const match=!q || [x.name,x.class,x.tags,x.location].some(v=>(v||'').toLowerCase().includes(q));
    return match && (category==='All categories'||x.class===category) && (location==='All locations'||x.location===location);
  }),[items,search,category,location]);
  const total = items.reduce((n,x)=>n+(Number(x.qty)||0),0);

  async function save(form) {
    const payload={name:form.name,class:form.itemClass,tags:form.tags,location:form.location,qty:form.qty,synced:true,updated_at:new Date().toISOString()};
    let result;
    if (form.id) result=await db.from('inventory').update(payload).eq('id',form.id);
    else {
      const nextId=items.reduce((m,x)=>Math.max(m,Number(x.id)||0),0)+1;
      result=await db.from('inventory').insert({...payload,id:nextId});
    }
    if(result.error) return {error:result.error.message};
    await refresh(); setMessage(form.id?'Item updated':'Item added'); return {};
  }
  async function remove(item) {
    if(!window.confirm('Delete “'+item.name+'”? This cannot be undone.')) return;
    const {error}=await db.from('inventory').delete().eq('id',item.id);
    if(error) setError(error.message); else {await refresh();setMessage('Item deleted');}
  }
  useEffect(()=>{if(!message)return;const t=setTimeout(()=>setMessage(''),2600);return()=>clearTimeout(t)},[message]);

  if(!db) return <main className="login-page"><div className="login-card"><h1>Configuration missing</h1><p>Supabase URL or publishable key was not included in the build.</p></div></main>;
  if(!ready) return <div className="loading">Loading…</div>;
  if(!session) return <Login onSignedIn={()=>db.auth.getSession().then(({data})=>setSession(data.session))}/>;

  return <div className="layout">
    <aside className="sidebar"><div className="brand"><span className="brand-icon small"><Boxes/></span><div><b>Family Inventory</b><small>Shared workspace</small></div></div><p className="nav-label">WORKSPACE</p><div className="nav-current"><Package size={18}/> Inventory <span>{items.length}</span></div><div className="account"><div className="avatar">{(session.user.email||'U')[0].toUpperCase()}</div><div className="account-text"><b>{session.user.email}</b><small>Signed in</small></div><button className="icon-button" title="Sign out" onClick={()=>db.auth.signOut()}><LogOut size={17}/></button></div></aside>
    <main className="main">
      <header className="topbar"><div><p className="eyebrow">YOUR HOUSEHOLD</p><h1>Inventory</h1></div><button className="primary" onClick={()=>setDialog({})}><Plus size={18}/> Add item</button></header>
      <section className="welcome"><div><h2>Everything in its place.</h2><p>Keep track of your supplies and where they live.</p></div><Boxes size={42}/></section>
      <section className="stats"><div className="stat"><Package/><div><small>Item types</small><b>{items.length}</b></div></div><div className="stat"><Boxes/><div><small>Total quantity</small><b>{total.toLocaleString()}</b></div></div><div className="stat"><MapPin/><div><small>Locations</small><b>{locations.length}</b></div></div></section>
      <section className="panel"><div className="panel-head"><div><h2>All items</h2><small>{shown.length} results</small></div><button className="secondary" onClick={refresh} disabled={busy}><RefreshCw size={16}/> Refresh</button></div>
        <div className="filters"><div className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search names, tags or categories…" /></div><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select><select value={location} onChange={e=>setLocation(e.target.value)}><option>All locations</option>{locations.map(x=><option key={x}>{x}</option>)}</select></div>
        {error&&<p className="error"><AlertCircle size={16}/>{error}</p>}
        <div className="table-scroll"><table><thead><tr><th>ITEM</th><th>CATEGORY</th><th>LOCATION</th><th>QTY</th><th></th></tr></thead><tbody>{shown.map(item=><tr key={item.id}><td><b>{item.name}</b>{item.tags&&<small className="tags">{item.tags}</small>}</td><td><span className="pill">{item.class||'Uncategorised'}</span></td><td>{item.location||'—'}</td><td><b>{item.qty}</b></td><td><div className="actions"><button className="icon-button" title="Edit" onClick={()=>setDialog(item)}><Pencil size={16}/></button><button className="icon-button danger" title="Delete" onClick={()=>remove(item)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
        {!shown.length&&<div className="empty"><Package size={30}/><h3>{items.length?'No matching items':'Your inventory is empty'}</h3><p>{items.length?'Try a different search or filter.':'Add your first item to get started.'}</p>{!items.length&&<button className="primary" onClick={()=>setDialog({})}><Plus size={17}/> Add first item</button>}</div>}
      </section>
      <footer>Changes are saved to your shared family database automatically.</footer>
    </main>
    {message&&<div className="toast">{message}</div>}
    {dialog&&<ItemDialog item={dialog.id?dialog:null} locations={locations} onClose={()=>setDialog(null)} onSave={save}/>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
