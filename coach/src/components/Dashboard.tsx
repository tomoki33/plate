'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { kpisOf, mealBars, needCount, recentMealDay, sortJoined, sortStalled, summarize, trainingHistory, weekMarks, weightAvg7, weightSeries, type StudentSummary } from '@core/features/coach/aggregate';
import { addKey, shortMd, todayIn, weekStartKey } from '@core/features/coach/dateKeys';
import { currentWeightOf, effectiveFromFor, goalFor, initialDraft, paceChoices, planWarnings, previewPlan, signedPace, withFat, withPace, withProtein, withTarget, type PlanDraft } from '@core/features/coach/plan';
import type { CoachInfo, CoachMenu } from '@core/features/coach/types';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabase';

const K = '#1F1712', O = '#E85C31', N = '#E4DAD1';
const WD = ['月', '火', '水', '木', '金', '土', '日'];
const INPUT_JP: Record<string, string> = { set: 'マイセット', search: '検索', text: '文章', photo: '写真から', rough: 'ざっくり' };
const GOAL_JP = { cut: '減量', maintain: '維持', bulk: '増量' } as const;
const markColor = (m: string) => (m === 'train' ? O : m === 'log' ? K : N);

export function Dashboard({ email }: { email: string }) {
  const [coach, setCoach] = useState<CoachInfo | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.fetchStudents>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never>([]);
  const [menus, setMenus] = useState<CoachMenu[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'stalled' | 'joined'>('stalled');
  const [sel, setSel] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, s, m] = await Promise.all([api.fetchCoach(), api.fetchStudents(), api.fetchMenus()]);
    if (c.ok) setCoach(c.data);
    if (s.ok) setRows(s.data);
    if (m.ok) setMenus(m.data);
    setError(!c.ok ? c.error : !s.ok ? s.error : null);
    setLoading(false);
  }, []);
  // 画面を開いたときに一度だけ読み込む
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const items = rows.map((r) => summarize(r));
    return sort === 'stalled' ? sortStalled(items) : sortJoined(items);
  }, [rows, sort]);
  const need = needCount(list);
  const cur = list.find((x) => x.row.userId === sel) ?? list[0] ?? null;

  return (
    <div>
      <header style={{ height: 60, background: K, color: '#FBF7F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div className="num" style={{ fontSize: 20, fontWeight: 700, letterSpacing: 3 }}>PLATE <span style={{ fontSize: 11, color: '#F7CDBB', letterSpacing: 2 }}>COACH</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => setInvite(true)} style={{ background: 'none', border: 'none', color: '#FBF7F3', fontWeight: 700, fontSize: 13 }}>＋ 生徒を招待</button>
          <span style={{ fontSize: 12, color: '#F7CDBB' }}>{coach?.name ?? email}</span>
          <button onClick={() => supabase().auth.signOut()} style={{ background: 'none', border: '0.5px solid #5A4D44', color: '#FBF7F3', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>ログアウト</button>
        </div>
      </header>
      {error && <div style={{ padding: '10px 24px', color: 'var(--brand-text)', fontSize: 13 }}>{error}</div>}
      <div className="layout">
        <aside style={{ background: '#fff', borderRight: '0.5px solid var(--line)' }}>
          <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <b style={{ fontSize: 16 }}>生徒</b>
            {rows.length > 0 && <span style={{ fontSize: 12, color: 'var(--sub)' }}><b className="num" style={{ fontSize: 15, color: K }}>{need}</b> 人に声かけを</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--track)', borderRadius: 8, padding: 3, margin: '0 16px 8px' }}>
            {([['stalled', '止まっている順'], ['joined', '登録順']] as const).map(([v, t]) => (
              <button key={v} onClick={() => setSort(v)} style={{ height: 32, border: 'none', borderRadius: 6, background: sort === v ? '#fff' : 'transparent', fontWeight: sort === v ? 700 : 400, fontSize: 12.5 }}>{t}</button>
            ))}
          </div>
          {list.map((s) => <StudentRowItem key={s.row.userId} s={s} active={cur?.row.userId === s.row.userId} onClick={() => setSel(s.row.userId)} />)}
          {!list.length && !loading && <p style={{ padding: 20, color: 'var(--sub)', fontSize: 13, lineHeight: 1.8 }}>まだ生徒がいません。「＋ 生徒を招待」から招待コードを送ってください。</p>}
        </aside>
        <main style={{ padding: 24, minWidth: 0 }}>
          {cur ? <Detail key={cur.row.userId} s={cur} menus={menus} reload={load} /> : <p style={{ color: 'var(--sub)' }}>{loading ? '読み込み中…' : '生徒を選んでください。'}</p>}
        </main>
      </div>
      {invite && (
        <div onClick={() => setInvite(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(31,23,18,.32)', display: 'grid', placeItems: 'center' }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 380, padding: 24, display: 'grid', gap: 12 }}>
            <b style={{ fontSize: 17 }}>生徒を招待</b>
            <span style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.8 }}>生徒がアプリの 設定 →「コーチと共有」でこのコードを入れると、共有の依頼が生徒に届きます。承認するまで、記録は何も見えません。</span>
            <div className="num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: 6, textAlign: 'center', padding: 16, border: '0.5px solid var(--line-strong)', borderRadius: 10 }}>{coach?.invite_code ?? '——'}</div>
            <button className="btn primary" onClick={() => coach && navigator.clipboard.writeText(coach.invite_code)}>コピー</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentRowItem({ s, active, onClick }: { s: StudentSummary; active: boolean; onClick: () => void }) {
  const dw = s.snapshot?.weight ? (() => { const a = weightAvg7(s.snapshot, s.today); const b = weightAvg7(s.snapshot, addKey(s.today, -7)); return a !== null && b !== null ? Math.round((a - b) * 10) / 10 : null; })() : null;
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 16px', border: 'none', borderBottom: '0.5px solid var(--line)', background: active ? 'var(--bg)' : '#fff', boxShadow: active ? 'inset 3px 0 0 #E85C31' : 'none' }}>
      <span style={{ width: 40, height: 40, borderRadius: '50%', background: active ? K : 'var(--track)', color: active ? '#fff' : K, display: 'grid', placeItems: 'center', fontWeight: 700 }}>{(s.row.studentName[0] ?? '?').toUpperCase()}</span>
      <span style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><b style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{s.row.studentName || '（名前なし）'}</b>{s.paused ? <span className="badge">ひとりで使用中</span> : s.badge ? <span className="badge">{s.badge}</span> : null}</span>
        <span style={{ display: 'flex', gap: 3 }}>{s.marks.map((m, i) => <i key={i} style={{ width: 14, height: 6, borderRadius: 2, background: markColor(m) }} />)}</span>
      </span>
      <span style={{ textAlign: 'right' }}>
        {!s.paused && <span className="num" style={{ fontSize: 19, fontWeight: 600 }}>{s.days}<span style={{ fontSize: 12, color: 'var(--sub)' }}>/7</span></span>}
        {dw !== null && <div className="num" style={{ fontSize: 11, color: 'var(--sub)' }}>{dw > 0 ? '+' : dw < 0 ? '−' : '±'}{Math.abs(dw).toFixed(1)}kg</div>}
      </span>
    </button>
  );
}

function Detail({ s, menus, reload }: { s: StudentSummary; menus: CoachMenu[]; reload: () => Promise<void> }) {
  const { row, snapshot: snap } = s;
  const [back, setBack] = useState(0);
  const [selDay, setSelDay] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);

  if (!snap) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <b>{row.studentName}</b>
        <p style={{ color: 'var(--sub)', fontSize: 13, lineHeight: 1.8 }}>ひとりで使用中（一時停止）です。共有が再開されると、ここに記録が表示されます。</p>
        <NoteBox userId={row.userId} name={row.studentName} today={s.today} last={row.lastNote?.body ?? null} reload={reload} />
      </div>
    );
  }
  const ws = addKey(weekStartKey(s.today), -7 * back);
  const kpis = kpisOf(snap, ws, back === 0 ? s.today : addKey(ws, 6));
  const bars = mealBars(snap, ws);
  const target = row.plan ? Number(row.plan.target_weight) : snap.profile.goalWeightKg;
  const series = weightSeries(snap, s.today, 8);
  const hist = trainingHistory(snap, 12);
  const day = selDay ? snap.meals?.recent.filter((m) => m.date === selDay) : recentMealDay(snap, s.today)?.meals;
  const goalLabel = row.plan ? `${GOAL_JP[Number(row.plan.pace_per_week) < 0 ? 'cut' : Number(row.plan.pace_per_week) > 0 ? 'bulk' : 'maintain']} → ${Number(row.plan.target_weight).toFixed(1)}kg` : snap.profile.goalWeightKg ? `${GOAL_JP[snap.profile.goal]} → ${snap.profile.goalWeightKg.toFixed(1)}kg` : GOAL_JP[snap.profile.goal];
  const max = ((bars.find((b) => b.targetKcal)?.targetKcal) ?? 2400) * 1.25;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 52, height: 52, borderRadius: '50%', background: K, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700 }}>{(row.studentName[0] ?? '?').toUpperCase()}</span>
          <div style={{ display: 'grid', gap: 5 }}><b style={{ fontSize: 22, fontWeight: 900 }}>{row.studentName}</b><span className="badge" style={{ fontSize: 11.5, justifySelf: 'start' }}>{goalLabel}</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn" style={{ width: 40, padding: 0 }} onClick={() => setBack(back + 1)} aria-label="前の週">‹</button>
          <span className="num" style={{ minWidth: 110, textAlign: 'center' }}>{shortMd(ws)} – {shortMd(addKey(ws, 6))}</span>
          <button className="btn" style={{ width: 40, padding: 0 }} disabled={back === 0} onClick={() => setBack(Math.max(0, back - 1))} aria-label="次の週">›</button>
          <button className="btn primary" style={{ marginLeft: 8 }} onClick={() => setEdit(!edit)}>{edit ? '閉じる' : '目標を変える'}</button>
        </div>
      </div>

      {edit && <GoalEditor s={s} menus={menus} onDone={async (m) => { setEdit(false); setMsg(m); await reload(); }} />}
      {msg && <div style={{ fontSize: 13, color: 'var(--brand-text)' }}>{msg}</div>}

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {kpis.map((k, i) => (
          <div key={k.key} style={{ padding: 16, display: 'grid', gap: 6, borderRight: i < 3 ? '0.5px solid var(--line)' : 'none' }}>
            <span style={{ fontSize: 12, color: 'var(--sub)' }}>{k.label}</span>
            {k.hidden ? <b style={{ color: 'var(--sub)' }}>非公開</b> : <span className="num" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1, color: k.low ? O : K }}>{k.value}<span style={{ fontSize: 13, color: 'var(--sub)' }}> {k.unit}</span></span>}
            {k.note && <span style={{ fontSize: 12, fontWeight: k.low ? 700 : 400, color: k.low ? 'var(--brand-text)' : 'var(--sub)' }}>{k.note}</span>}
          </div>
        ))}
      </div>

      <section className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <b style={{ fontSize: 14 }}>食事 <span style={{ fontWeight: 400, color: 'var(--sub)', fontSize: 12 }}>日をクリックで中身</span></b>
        {!snap.meals ? <span style={{ color: 'var(--sub)' }}>非公開（生徒が共有していません）</span> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8, alignItems: 'end', height: 190 }}>
              {bars.map((b, i) => (
                <button key={b.date} onClick={() => b.logged && setSelDay(b.date)} style={{ background: 'none', border: 'none', padding: 0, display: 'grid', gap: 4, alignContent: 'end', justifyItems: 'center', height: '100%' }}>
                  <span className="num" style={{ fontSize: 11, color: 'var(--sub)' }}>{b.kcal ?? ''}</span>
                  <i style={{ width: '100%', height: b.kcal ? Math.max(4, (120 * b.kcal) / max) : 0, background: (selDay ?? recentMealDay(snap, s.today)?.date) === b.date ? K : '#D3C4B8', borderRadius: '3px 3px 0 0' }} />
                  <span style={{ fontSize: 11, color: 'var(--sub)' }}>{WD[i]}</span>
                  <span className="num" style={{ fontSize: 11, minHeight: 14, color: b.P !== null && snap.profile.proteinG && b.P < snap.profile.proteinG * 0.85 ? 'var(--brand-text)' : 'var(--sub)' }}>{b.P !== null ? `P${b.P}` : ''}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 2, alignContent: 'start' }}>
              {(day ?? []).length ? day!.map((m, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 8, padding: '9px 0', borderBottom: '0.5px solid var(--line)', fontSize: 13, alignItems: 'center' }}>
                  <span style={{ color: 'var(--sub)', fontSize: 12 }}>{m.slot}</span>
                  <span style={{ minWidth: 0 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div><span className="num" style={{ fontSize: 11, color: 'var(--sub)' }}>P{m.P} F{m.F} C{m.C}・{INPUT_JP[m.input] ?? m.input}</span></span>
                  <span className="num" style={{ fontSize: 15, fontWeight: 600 }}>{m.kcal}</span>
                </div>
              )) : <span style={{ color: 'var(--sub)', fontSize: 13, border: '1px dashed var(--line-strong)', borderRadius: 8, padding: 16, textAlign: 'center' }}>記録なし</span>}
            </div>
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <b style={{ fontSize: 14 }}>体重</b>
        {!snap.weight ? <span style={{ color: 'var(--sub)' }}>非公開（生徒が共有していません）</span> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 20, alignItems: 'center' }}>
            <WeightSvg points={series} target={target ?? null} />
            <div style={{ display: 'grid', gap: 10 }}>
              <span className="num" style={{ fontSize: 34, fontWeight: 600 }}>{(weightAvg7(snap, s.today) ?? currentWeightOf(snap)).toFixed(1)}<span style={{ fontSize: 13, color: 'var(--sub)' }}> kg{target ? ` → ${target.toFixed(1)}kg` : ''}</span></span>
              <span style={{ fontSize: 12, color: 'var(--sub)' }}>直近4週</span>
              {[3, 2, 1, 0].map((w) => (
                <div key={w} style={{ display: 'flex', gap: 3 }}>{weekMarks(snap, addKey(weekStartKey(s.today), -7 * w)).map((m, i) => <i key={i} style={{ width: 22, height: 10, borderRadius: 2, background: markColor(m) }} />)}</div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
        <b style={{ fontSize: 14 }}>トレーニング <span style={{ fontWeight: 400, color: 'var(--sub)', fontSize: 12 }}>クリックで詳細</span></b>
        {!snap.training ? <span style={{ color: 'var(--sub)' }}>非公開（生徒が共有していません）</span> : hist.length === 0 ? <span style={{ color: 'var(--sub)', fontSize: 13 }}>まだ記録がありません</span> : hist.map((h, i) => (
          <div key={i} style={{ borderBottom: '0.5px solid var(--line)' }}>
            <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 10, padding: '10px 0', border: 'none', background: 'none', textAlign: 'left', alignItems: 'baseline' }}>
              <span className="num" style={{ fontWeight: 600 }}>{shortMd(h.date)}</span>
              <span><b style={{ fontSize: 14 }}>{h.name}</b> <span style={{ color: 'var(--badge-fg)', fontSize: 12.5 }}>{h.exercises.map((e) => e.name).join('・')}</span></span>
              <span className="num" style={{ fontSize: 13, color: h.best?.pr ? O : 'var(--sub)' }}>{h.best ? `${h.best.pr ? '更新 ' : ''}${h.best.name} ${h.best.e1rm}` : ''}</span>
            </button>
            {open === i && <div style={{ display: 'grid', gap: 4, padding: '0 0 10px 66px', fontSize: 13 }}>{h.exercises.map((e, j) => <div key={j}><span style={{ display: 'inline-block', width: 160 }}>{e.name}</span><span className="num" style={{ color: 'var(--badge-fg)' }}>{e.sets.map((x) => `${x.kg}×${x.reps}`).join('・')}</span></div>)}</div>}
          </div>
        ))}
      </section>

      <NoteBox userId={row.userId} name={row.studentName} today={s.today} last={row.lastNote?.body ?? null} reload={reload} />
      <p style={{ fontSize: 12, color: 'var(--sub)' }}>生徒が共有をオンにした項目だけ表示しています。写真は表示しません。</p>
    </div>
  );
}

function WeightSvg({ points, target }: { points: (number | null)[]; target: number | null }) {
  const vals = points.filter((v): v is number => v !== null);
  if (vals.length < 2) return <span style={{ color: 'var(--sub)', fontSize: 13 }}>推移を出すには、体重の記録が2週分ほど必要です</span>;
  const all = target !== null ? [...vals, target] : vals;
  const lo = Math.min(...all) - 0.5, hi = Math.max(...all) + 0.5, W = 420, H = 170, pad = 12;
  const x = (i: number) => pad + ((W - pad * 2) * i) / (points.length - 1);
  const y = (v: number) => pad + (H - pad * 2) * (1 - (v - lo) / (hi - lo));
  const pts = points.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
  const li = points.map((v) => v !== null).lastIndexOf(true);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
      {target !== null && <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="#8A7B70" strokeDasharray="4 4" />}
      <polyline points={pts} fill="none" stroke={K} strokeWidth={2} />
      <circle cx={x(li)} cy={y(points[li] as number)} r={5} fill={O} />
    </svg>
  );
}

function NoteBox({ userId, name, today, last, reload }: { userId: string; name: string; today: string; last: string | null; reload: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setErr(null);
    const r = await api.sendNote(userId, weekStartKey(today), text.trim());
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setText(''); await reload();
  };
  return (
    <section className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
      <b style={{ fontSize: 14 }}>ひとこと <span style={{ fontWeight: 400, color: 'var(--sub)', fontSize: 12 }}>月曜のまとめに添えて届きます</span></b>
      {last && <div style={{ fontSize: 13, color: 'var(--badge-fg)', lineHeight: 1.8 }}>直近に送った内容：{last}</div>}
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder={`${name}へ。例：記録が戻ってきたね。まずは週4日を目標に`} rows={3} style={{ border: '0.5px solid var(--line-strong)', borderRadius: 6, padding: 12, resize: 'none', lineHeight: 1.7 }} />
      {err && <span style={{ color: 'var(--brand-text)', fontSize: 12 }}>{err}</span>}
      <button className="btn primary" style={{ justifySelf: 'end', width: 120 }} disabled={!text.trim() || busy} onClick={send}>{busy ? '…' : '送る'}</button>
    </section>
  );
}

function GoalEditor({ s, menus, onDone }: { s: StudentSummary; menus: CoachMenu[]; onDone: (msg: string) => Promise<void> }) {
  const snap = s.snapshot;
  const [d, setD] = useState<PlanDraft>(() => initialDraft(snap, s.row.plan));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cur = currentWeightOf(snap);
  const goal = goalFor(cur, d.targetWeight);
  const p = previewPlan(d, snap);
  const btn = (t: string, f: () => void) => <button className="btn" style={{ width: 44, padding: 0 }} onClick={f}>{t}</button>;
  const save = async () => {
    setBusy(true); setErr(null);
    const r = await api.setGoalPlan(s.row.userId, d, menus.filter((m) => d.menuIds.includes(m.id)), effectiveFromFor(snap));
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    await onDone('送りました。明日から反映され、生徒に通知されます。');
  };
  return (
    <section className="card" style={{ padding: 16, display: 'grid', gap: 14 }}>
      <b>{s.row.studentName}の目標</b>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--sub)', width: 110 }}>目標体重（いま {cur.toFixed(1)}kg）</span>
        {btn('−', () => setD(withTarget(d, d.targetWeight - 0.5, cur)))}
        <span className="num" style={{ fontSize: 30, fontWeight: 600, minWidth: 90, textAlign: 'center' }}>{d.targetWeight.toFixed(1)}<span style={{ fontSize: 13, color: 'var(--sub)' }}> kg</span></span>
        {btn('＋', () => setD(withTarget(d, d.targetWeight + 0.5, cur)))}
        {goal !== 'maintain' ? (
          <span style={{ display: 'inline-flex', background: 'var(--track)', borderRadius: 8, padding: 3, gap: 2 }}>
            {paceChoices(goal, cur).map((m) => { const on = Math.abs(Math.abs(d.pace) - m) < 0.001; return <button key={m} onClick={() => setD(withPace(d, goal, m))} className="num" style={{ height: 36, padding: '0 12px', border: 'none', borderRadius: 6, background: on ? '#fff' : 'transparent', fontWeight: 600 }}>{signedPace(goal, m) > 0 ? '+' : '−'}{m.toFixed(2)} kg/週</button>; })}
          </span>
        ) : <span style={{ fontSize: 12, color: 'var(--sub)' }}>維持として送ります</span>}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: 'var(--sub)' }}>1日の目安（トレーニングの日）</span><b className="num">{p.day.kcal.toLocaleString()} kcal</b></div>
        {([['P', 'var(--P)', p.day.P, `${p.pPerKg}g/kg`, () => setD(withProtein(d, d.proteinG - 5)), () => setD(withProtein(d, d.proteinG + 5))], ['F', 'var(--F)', p.day.F, `${d.fatPct}%`, () => setD(withFat(d, d.fatPct - 5)), () => setD(withFat(d, d.fatPct + 5))], ['C', 'var(--C)', p.day.C, '自動', null, null]] as const).map(([k, c, v, r, dn, up]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 100px 96px', gap: 10, alignItems: 'center' }}>
            <b style={{ color: c }}>{k}</b>
            <div style={{ height: 6, background: 'var(--track)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, ((k === 'F' ? 9 : 4) * v * 100) / (p.day.kcal || 1))}%`, background: c }} /></div>
            <span className="num" style={{ fontWeight: 600 }}>{v}g <span style={{ fontSize: 12, color: 'var(--sub)' }}>{r}</span></span>
            <span style={{ display: 'flex', gap: 6 }}>{dn && up ? <>{btn('−', dn)}{btn('＋', up)}</> : null}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--sub)' }}>メニュー</span>
        {menus.map((m) => { const on = d.menuIds.includes(m.id); return <button key={m.id} onClick={() => setD({ ...d, menuIds: on ? d.menuIds.filter((x) => x !== m.id) : [...d.menuIds, m.id] })} className="btn" style={{ height: 34, background: on ? K : '#fff', color: on ? '#fff' : K }}>{m.name}</button>; })}
        {!menus.length && <span style={{ fontSize: 12, color: 'var(--sub)' }}>アプリの「メニュー」タブで作れます</span>}
      </div>
      {planWarnings(d, snap).map((w) => <span key={w} style={{ color: 'var(--brand-text)', fontSize: 12 }}>{w}</span>)}
      {err && <span style={{ color: 'var(--brand-text)', fontSize: 12 }}>{err}</span>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 12, color: 'var(--sub)' }}>明日から反映し、生徒に通知します</span><button className="btn primary" disabled={busy} onClick={save}>{busy ? '送っています…' : '保存して送る'}</button></div>
    </section>
  );
}
