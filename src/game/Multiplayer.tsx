import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Copy, LogOut } from 'lucide-react';
import { network, useNetwork, isGuest, type Room, type RemoteState } from './network-state';
import { world, resetWorld, controlPrefs, type ControlMode } from './world';
import { useGame, type PickupKind } from './store';
import { gates, refreshGateCosts } from './zones';
import { ubers, feedKill, allUbersCharged } from './uber';

let sessionToken = '';
function token() {
  if (!sessionToken) {
    sessionToken = sessionStorage.getItem('zombie-room-token') ?? Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('zombie-room-token', sessionToken);
  }
  return sessionToken;
}
export async function roomAction(action: string, code = '', name = '') {
  const { data, error } = await supabase.rpc('zombie_room_action', { action, room: code, token: token(), player_name: name });
  if (error) throw new Error(error.message);
  return data as unknown as Room;
}
export function beginMatch(room: Room) {
  resetWorld(); useGame.getState().start();
  const slot = room.members.findIndex(m => m.id === room.id);
  world.playerPos.set((slot - 1) * 2.5, 0, 2);
}
export function MultiplayerLobby({ onMode }: { onMode: (mode: ControlMode) => void }) {
  const { room, connected, error } = useNetwork();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<ControlMode>(controlPrefs.mode);
  async function act(action: string) {
    setBusy(true); useNetwork.setState({ error: '' });
    try {
      const result = await roomAction(action, room?.code ?? code.trim().toUpperCase(), name);
      if (action === 'leave') { useNetwork.setState({ room: null }); setOpen(false); }
      else useNetwork.setState({ room: result });
    } catch (e) { useNetwork.setState({ error: e instanceof Error ? e.message : 'Connessione non disponibile' }); }
    finally { setBusy(false); }
  }
  if (!open && !room) return <Button variant="outline" className="mt-4 font-hud" onClick={() => setOpen(true)}><Users /> Multiplayer · 3 giocatori</Button>;
  return <section className="mt-4 w-full max-w-sm space-y-3 border-t border-border pt-4 text-left font-hud">
    <div className="flex items-center justify-between"><h2 className="text-lg text-accent">Squadra · massimo 3</h2><Button variant="ghost" size="icon" aria-label="Chiudi multiplayer" onClick={() => room ? void act('leave') : setOpen(false)}><LogOut /></Button></div>
    <div className="grid grid-cols-3 gap-2">{(['pc','touch','pad'] as const).map(m => <Button key={m} variant={mode === m ? 'default' : 'outline'} onClick={() => { setMode(m); onMode(m); }}>{m === 'pc' ? 'PC' : m === 'touch' ? 'Telefono' : 'PS'}</Button>)}</div>
    {!room ? <><Input aria-label="Nome giocatore" placeholder="Il tuo nome" maxLength={20} value={name} onChange={e => setName(e.target.value)} /><Button className="w-full" disabled={busy} onClick={() => void act('create')}>Crea stanza</Button><div className="flex gap-2"><Input aria-label="Codice stanza" placeholder="Codice stanza" value={code} maxLength={8} onChange={e => setCode(e.target.value.toUpperCase())} /><Button variant="outline" disabled={busy || code.length !== 8} onClick={() => void act('join')}>Entra</Button></div></> : <>
      <div className="flex items-center justify-between text-accent"><strong className="text-2xl">{room.code}</strong><Button variant="ghost" size="icon" aria-label="Copia codice" onClick={() => { void navigator.clipboard?.writeText(room.code).then(() => useNetwork.setState({ error: 'Codice copiato' })).catch(() => useNetwork.setState({ error: `Codice: ${room.code}` })); }}><Copy /></Button></div>
      <ul className="space-y-1">{room.members.map(m => <li key={m.id} className="flex justify-between text-foreground"><span>{m.name}{m.id === room.id ? ' (tu)' : ''}</span><span className="text-muted-foreground">{m.id === room.hostId ? 'Caposquadra' : 'Pronto'}</span></li>)}</ul>
      <div className="text-sm text-muted-foreground">{connected ? `${room.members.length}/3 collegati` : 'Collegamento…'}</div>
      {room.hostId === room.id ? <Button className="w-full" disabled={busy || !connected || room.members.length < 2} onClick={() => void act('start')}>Avvia partita</Button> : <p className="text-sm text-muted-foreground">In attesa del caposquadra</p>}
    </>}
    {error && <p role="status" className="text-sm text-accent">{error}</p>}
  </section>;
}

type Snapshot = ReturnType<typeof makeSnapshot>;
function makeSnapshot() {
  const g = useGame.getState();
  return { round: g.round, left: g.zombiesLeft, boss: g.bossHp, gates: gates.map(x => x.open), charges: ubers.map(x => x.charge), zombies: world.zombies.map(z => ({ active: z.active, x: z.pos.x, z: z.pos.z, hp: z.hp, maxHp: z.maxHp, facing: z.facing, dying: z.dying, boss: z.boss, scale: z.scale, phase: z.phase, hitFlash: z.hitFlash, damage: z.damage, speed: z.speed })), pickups: world.pickups.map(p => ({ active: p.active, x: p.pos.x, z: p.pos.z, kind: p.kind, life: p.life })) };
}
function applySnapshot(s: Snapshot) {
  if (!s || !Array.isArray(s.zombies)) return;
  s.zombies.forEach((z, i) => { const target = world.zombies[i]; if (!target) return; Object.assign(target, z); target.pos.set(z.x, 0, z.z); });
  s.pickups.forEach((p, i) => { const target = world.pickups[i]; if (!target) return; Object.assign(target, p); target.pos.set(p.x, 0, p.z); });
  s.gates.forEach((open, i) => { const gate = gates[i]; if (gate) gate.open = open; }); refreshGateCosts();
  s.charges.forEach((charge, i) => { const u = ubers[i]; if (u) u.charge = charge; });
  const g = useGame.getState(); if (g.round !== s.round) g.setRound(s.round);
  useGame.setState({ zombiesLeft: s.left, bossHp: s.boss, gatesOpened: s.gates.filter(Boolean).length });
  g.syncUbers(s.charges, allUbersCharged());
}

export function MultiplayerConnection() {
  const code = useNetwork(s => s.room?.code);
  useEffect(() => {
    if (!code) return;
    let stopped = false, subscribed = false, polling = false, last = '', lastAt = 0;
    const channel = supabase.channel(`zombie-coop:${code}`, { config: { broadcast: { self: false } } });
    const send = (payload: Record<string, unknown>) => { if (subscribed) void channel.send({ type: 'broadcast', event: 'packet', payload }); };
    network.damage = (id, amount) => send({ kind: 'damage', id, amount });
    channel.on('broadcast', { event: 'packet' }, ({ payload }) => {
      const r = useNetwork.getState().room; if (!r || !r.started) return;
      if (payload.kind === 'damage' && payload.id === r.id) useGame.getState().damage(Number(payload.amount) || 0);
      if (payload.kind === 'reward' && payload.id === r.id) { const g = useGame.getState(); if (payload.kill) g.addKill(Number(payload.points)); else g.addHit(Number(payload.points)); }
      if (payload.kind === 'gate-result' && payload.id === r.id) useGame.setState(s => ({ points: Math.max(0, s.points - Number(payload.cost)), notice: 'Cancello aperto' }));
      if (payload.kind === 'pickup-result' && payload.id === r.id) { const g = useGame.getState(); if (payload.pickup !== 'nuke') g.applyPickup(payload.pickup as PickupKind); else g.addHit(400); }
      if (payload.kind !== 'state' || !r.members.some(m => m.id === payload.player?.id) || payload.player.id === r.id) return;
      const p = payload.player as RemoteState;
      network.remotes.set(p.id, p);
      if (p.id === r.hostId && isGuest() && payload.snapshot) applySnapshot(payload.snapshot);
      if (r.id !== r.hostId || !Array.isArray(payload.commands)) return;
      for (const cmd of payload.commands) {
        if (cmd.kind === 'hit') {
          const z = world.zombies[Number(cmd.index)];
          if (!z?.active || z.dying > 0 || Math.hypot(z.pos.x-p.x,z.pos.z-p.z)>75) continue;
          z.hp -= Math.min(999, Math.max(0, Number(cmd.damage) || 0)); z.hitFlash = 1;
          const kill = z.hp <= 0;
          if (kill) { z.dying = 0.001; feedKill(z.pos); useGame.getState().syncUbers(ubers.map(u => u.charge), allUbersCharged()); }
          send({ kind: 'reward', id: p.id, kill, points: kill ? z.boss ? 1500 : cmd.head ? 160 : 90 : cmd.head ? 40 : 15 });
        }
        if (cmd.kind === 'gate') {
          const gate = gates[Number(cmd.index)]; const cost = gate?.cost ?? 0;
          if (!gate || gate.open || Number(cmd.points) < cost || Math.hypot(gate.x-p.x,gate.z-p.z)>5) continue;
          gate.open = true; refreshGateCosts(); send({ kind: 'gate-result', id: p.id, cost });
        }
        if (cmd.kind === 'pickup') {
          const pickup = world.pickups[Number(cmd.index)];
          if (!pickup?.active || Math.hypot(pickup.pos.x-p.x,pickup.pos.z-p.z)>2) continue;
          pickup.active = false;
          if (pickup.kind === 'nuke') world.zombies.forEach(z => { if (!z.active || z.dying) return; if (z.boss) z.hp = Math.max(1,z.hp-z.maxHp*.3); else z.dying=.001; });
          send({ kind: 'pickup-result', id: p.id, pickup: pickup.kind });
        }
      }
    }).subscribe(status => {
      subscribed = status === 'SUBSCRIBED';
      useNetwork.setState({ connected: subscribed, ...(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? { error: 'Connessione interrotta. Esci e rientra nella stanza.' } : {}) });
    });
    async function poll() {
      if (polling || stopped) return; polling = true;
      try {
        const r = await roomAction('heartbeat', code);
        if (stopped) return;
        const previous = useNetwork.getState().room;
        if (!r.hostId && previous?.started) { useGame.getState().toMenu(); useNetwork.setState({ room: null, error: 'Il caposquadra ha lasciato la partita' }); return; }
        useNetwork.setState({ room: r });
        for (const id of network.remotes.keys()) if (!r.members.some(m => m.id === id)) network.remotes.delete(id);
        if (r.started && !previous?.started) beginMatch(r);
        // The start action can update the room before the heartbeat.
        if (r.started && useGame.getState().phase === 'menu') beginMatch(r);
      } catch (e) { if (!stopped) { useGame.getState().toMenu(); useNetwork.setState({ room: null, error: e instanceof Error ? e.message : 'Connessione persa' }); } }
      finally { polling = false; }
    }
    void poll();
    const heartbeat = setInterval(() => void poll(), 3000);
    const tick = setInterval(() => {
      const r = useNetwork.getState().room; const g = useGame.getState();
      if (!r?.started || !subscribed || document.hidden) return;
      const player: RemoteState = { id: r.id, x: world.playerPos.x, z: world.playerPos.z, yaw: world.yaw, health: g.health, phase: g.phase, widow: g.perks.includes('widow') };
      const commands = network.commands.splice(0, 40);
      const snapshot = r.hostId === r.id ? makeSnapshot() : undefined;
      const state = JSON.stringify({ player, snapshot }); const now = performance.now();
      if (state === last && !commands.length && now-lastAt<1000) return;
      last = state; lastAt = now; send({ kind: 'state', player, commands, snapshot });
      // A dead host keeps the shared simulation alive; everyone can still finish the round.
    }, 125);
    return () => { stopped = true; clearInterval(heartbeat); clearInterval(tick); void supabase.removeChannel(channel); network.remotes.clear(); network.commands.length=0; network.damage=()=>{}; useNetwork.setState({ connected: false }); };
  }, [code]);
  return null;
}

function RemotePlayer({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null); const right = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const p = network.remotes.get(id); const mesh = group.current;
    if (!p || !mesh) return;
    mesh.visible = p.health > 0;
    const t = 1-Math.exp(-12*Math.min(dt,.05)); const oldX = mesh.position.x, oldZ = mesh.position.z;
    if (Math.hypot(oldX-p.x,oldZ-p.z)>5) mesh.position.set(p.x,0,p.z);
    else { mesh.position.x += (p.x-oldX)*t; mesh.position.z += (p.z-oldZ)*t; }
    mesh.rotation.y += Math.atan2(Math.sin(p.yaw-mesh.rotation.y), Math.cos(p.yaw-mesh.rotation.y))*t;
    const swing = Math.hypot(oldX-p.x,oldZ-p.z)>.04 ? Math.sin(performance.now()*.009)*.5 : 0;
    if (left.current) left.current.rotation.x=swing; if (right.current) right.current.rotation.x=-swing;
  });
  return <group ref={group} visible={false} name={`teammate-${id}`}>
    <mesh position={[0,1.15,0]} castShadow><boxGeometry args={[.65,.75,.35]} /><meshStandardMaterial color="#33413a" /></mesh>
    <mesh position={[0,1.72,0]} castShadow><sphereGeometry args={[.23,10,8]} /><meshStandardMaterial color="#c9a98a" /></mesh>
    <mesh position={[0,1.91,0]}><boxGeometry args={[.48,.12,.4]} /><meshStandardMaterial color="#26302b" /></mesh>
    <mesh position={[0,1.15,-.21]}><boxGeometry args={[.5,.55,.13]} /><meshStandardMaterial color="#3d3427" /></mesh>
    {([-1,1] as const).map(side => <group key={side} position={[side*.19,.78,0]} ref={side===-1?left:right}><mesh position={[0,-.32,0]} castShadow><boxGeometry args={[.23,.7,.25]} /><meshStandardMaterial color="#242a30" /></mesh><mesh position={[0,-.7,-.07]}><boxGeometry args={[.27,.17,.4]} /><meshStandardMaterial color="#15181b" /></mesh></group>)}
    <mesh position={[.32,1.25,-.26]} rotation-x={-1.25}><boxGeometry args={[.19,.65,.2]} /><meshStandardMaterial color="#33413a" /></mesh>
    <mesh position={[.25,1.32,-.65]}><boxGeometry args={[.14,.15,.7]} /><meshStandardMaterial color="#14181c" /></mesh>
  </group>;
}
export function RemotePlayers() {
  const room = useNetwork(s => s.room);
  return <group>{room?.started && room.members.filter(m => m.id !== room.id).map(m => <RemotePlayer key={m.id} id={m.id} />)}</group>;
}
export function TeamHUD() {
  const room = useNetwork(s => s.room); const connected = useNetwork(s => s.connected);
  if (!room?.started) return null;
  return <div className="pointer-events-auto absolute left-4 top-24 max-w-40 space-y-1 font-hud text-xs text-foreground"><div className="text-accent">Squadra {room.members.length}/3 · {room.code}</div>{room.members.map(m => <div key={m.id}>{m.name}{m.id===room.id?' (tu)':''}</div>)}{!connected && <p className="text-destructive">Riconnessione…</p>}<Button variant="ghost" size="sm" onClick={() => { void roomAction('leave',room.code).catch(()=>{}); useNetwork.setState({ room:null }); useGame.getState().toMenu(); document.exitPointerLock?.(); }}><LogOut /> Esci</Button></div>;
}