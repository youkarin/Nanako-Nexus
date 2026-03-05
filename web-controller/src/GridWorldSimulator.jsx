import React, { useRef, useEffect, useState, useCallback } from 'react';
import { loadPois, POI_KEY, findLocation } from './mapUtils';

// ════════════════════════════════════════════════════════════
//  NANAKO WORLD  v2 — 48×28 grid, fully furnished interiors
// ════════════════════════════════════════════════════════════
const COLS = 48, ROWS = 28, CELL = 48;

const C = {
    sky: '#1a2a3a', grass: '#7bc67e', grassAlt: '#6db870',
    road: '#546e7a', roadLine: '#ffd54f',
    sidewalk: '#cfd8dc', sidewalkEdge: '#b0bec5',
    // Home
    homeWall: '#5d4037', homeTrim: '#8d6e63',
    bedroomFloor: '#c8a474', bedroomAlt: '#b8915f',
    livingFloor: '#d4aa78', livingAlt: '#c49a65',
    kitchenFloor: '#e8d5b0', kitchenAlt: '#d8c09a',
    corridor: '#c0a070',
    // Bath
    bathWall: '#4a7a8a', bathFloor: '#cce8f0', bathAlt: '#b8d8e8',
    bathTile: '#a8d0e0',
    // Park
    parkGrass: '#5db85d', parkAlt: '#50aa50', parkPath: '#c9b99a',
    // Commercial
    mallWall: '#3f51b5', mallFloor: '#e8eaf6', mallAlt: '#dde2f5',
    cityWall: '#78716c', cityFloor: '#f5f0e8', cityAlt: '#ede8dc',
    cafeWall: '#6f4e37', cafeFloor: '#d4a574', cafeAlt: '#c49060',
    marketWall: '#b45309', marketFloor: '#e8d18a', marketAlt: '#d8c078',
    // Furniture
    desk: '#8d6e63', deskScreen: '#1a3a5c', deskScreenOn: '#2563eb',
    chair: '#6d4c41', chairSeat: '#7c5c44',
    bedFrame: '#a0736a', bedCover: '#f06292', bedCover2: '#e91e63', pillow: '#fff9c4',
    shelf: '#4e342e', book: ['#ef5350', '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#ec407a', '#26c6da'],
    plant: '#388e3c', plantDark: '#2e7d32', pot: '#a1887f', treeLight: '#81c784',
    table: '#9c6b3c', tableTop: '#b17d4c',
    sofa: '#5c6bc0', sofaDark: '#3f51b5', sofaCushion: '#7986cb',
    counter: '#a07850', counterTop: '#b89060',
    bath: '#b3d9f7', bathEdge: '#90c8f0', sink: '#e0f2fe',
    stove: '#607d8b', burner: '#37474f',
    mat: '#ef9a9a', rug: '#7986cb', rug2: '#ef9a9a',
    barrel: '#795548', barrelRing: '#5d4037',
    tree: '#4caf50', treeDark: '#2e7d32', treeTrunk: '#8d6e63',
    flower: ['#f48fb1', '#fff176', '#ce93d8', '#80deea', '#ffab91'],
    bench: '#8d6e63', benchtop: '#a07850',
    fountain: '#90caf9', fountainRing: '#cfd8dc',
    lamp: '#546e7a', lampGlow: '#fff9c4',
    vend: '#1976d2', tv: '#212121', tvScreen: '#1565c0',
    wardrobe: '#4e342e', wardrobeDoor: '#6d4c41',
    couch2: '#7986cb',
};

// ── Walkability ───────────────────────────────────────────────
function buildWalkGrid() {
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    const wall = (x, y, w, h, doors = []) => {
        for (let r = y; r < y + h; r++)
            for (let c = x; c < x + w; c++) {
                const edge = r === y || r === y + h - 1 || c === x || c === x + w - 1;
                if (edge && !doors.some(([dc, dr]) => dc === c && dr === r)) g[r][c] = false;
            }
    };
    wall(2, 3, 14, 11, [[7, 13]]);                             // Home
    wall(17, 3, 18, 11, [[24, 13]]);                            // Bath/Kitchen
    wall(13, 17, 7, 8, [[15, 17]]);                            // Mall
    wall(21, 17, 8, 8, [[24, 17]]);                            // City Hall
    wall(30, 17, 7, 8, [[32, 17]]);                            // Coffee
    wall(38, 17, 9, 8, [[40, 17]]);                            // Market
    return g;
}
const WALK_GRID = buildWalkGrid();

function findPath(sc, sr, ec, er) {
    if (sc === ec && sr === er) return [[sc, sr]];
    if (!WALK_GRID[er]?.[ec]) return null;
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const prev = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const D = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const q = [[sc, sr]]; visited[sr][sc] = true;
    while (q.length) {
        const [c, r] = q.shift();
        if (c === ec && r === er) { const p = []; let u = [ec, er]; while (u) { p.unshift(u); u = prev[u[1]][u[0]]; } return p; }
        for (const [dc, dr] of D) {
            const nc = c + dc, nr = r + dr;
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || visited[nr][nc] || !WALK_GRID[nr][nc]) continue;
            visited[nr][nc] = true; prev[nr][nc] = [c, r]; q.push([nc, nr]);
        }
    }
    return null;
}

// ── Furniture renderer (polished) ───────────────────────────
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
const shad = (ctx, a = 0.32) => { ctx.shadowColor = `rgba(20,10,5,${a})`; ctx.shadowBlur = 7; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3; };
const noShad = ctx => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };

function drawFurniture(ctx, type, col, row, cs) {
    const x = col * cs, y = row * cs, s = cs;
    ctx.save();
    switch (type) {
        case 'bed':
            shad(ctx); ctx.fillStyle = C.bedFrame; rr(ctx, x + 2, y + 2, s - 4, s - 4, 5); noShad(ctx);
            ctx.fillStyle = C.bedCover; rr(ctx, x + 4, y + s * .35, s - 8, s * .57, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + 4, y + s * .35, s - 8, s * .12, 4); // sheen
            ctx.fillStyle = C.pillow; rr(ctx, x + 5, y + 5, s - 10, s * .28, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x + 5, y + 5, (s - 10) * .5, s * .1, 2);
            break;
        case 'bed2':
            shad(ctx); ctx.fillStyle = C.bedFrame; rr(ctx, x + 2, y + 2, s - 4, s - 4, 5); noShad(ctx);
            ctx.fillStyle = C.bedCover2; rr(ctx, x + 4, y + s * .35, s - 8, s * .57, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + 4, y + s * .35, s - 8, s * .1, 3);
            const pw = (s - 14) / 2;
            ctx.fillStyle = C.pillow; rr(ctx, x + 5, y + 5, pw, s * .28, 3);
            ctx.fillStyle = '#fce4ec'; rr(ctx, x + 8 + pw, y + 5, pw, s * .28, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, x + 5, y + 5, pw * .6, s * .1, 2);
            break;
        case 'desk':
            shad(ctx); ctx.fillStyle = C.desk; rr(ctx, x + 2, y + s * .32, s - 4, s * .55, 5); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 2, y + s * .32, s - 4, s * .15, 5);
            // screen
            shad(ctx); ctx.fillStyle = C.deskScreen; rr(ctx, x + s * .12, y + 3, s * .76, s * .4, 4); noShad(ctx);
            // screen gradient glow
            const sg = ctx.createLinearGradient(x + s * .12, y + 4, x + s * .12, y + s * .4);
            sg.addColorStop(0, '#1e88e5'); sg.addColorStop(0.5, '#1565c0'); sg.addColorStop(1, '#0d47a1');
            ctx.fillStyle = sg; rr(ctx, x + s * .14, y + 5, s * .72, s * .32, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, x + s * .14, y + 5, s * .72, s * .1, 3);
            // keyboard
            ctx.fillStyle = '#546e7a'; rr(ctx, x + s * .08, y + s * .72, s * .74, s * .16, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, x + s * .1, y + s * .73, s * .3, s * .06, 2);
            break;
        case 'tv':
            ctx.fillStyle = '#263238'; rr(ctx, x + s * .05, y + s * .5, s * .9, s * .1, 3);
            shad(ctx); ctx.fillStyle = '#1a2428'; rr(ctx, x + s * .07, y + s * .06, s * .86, s * .46, 5); noShad(ctx);
            const tv = ctx.createLinearGradient(x + s * .09, y + s * .08, x + s * .09, y + s * .5);
            tv.addColorStop(0, '#1565c0'); tv.addColorStop(0.4, '#1976d2'); tv.addColorStop(1, '#0d47a1');
            ctx.fillStyle = tv; rr(ctx, x + s * .09, y + s * .08, s * .82, s * .4, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .09, y + s * .08, s * .82, s * .12, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, x + s * .09, y + s * .33, s * .82, s * .04, 1);
            ctx.fillStyle = '#37474f'; rr(ctx, x + s * .44, y + s * .48, s * .12, s * .05, 2);
            break;
        case 'wardrobe':
            shad(ctx); ctx.fillStyle = C.wardrobe; rr(ctx, x + 2, y + 2, s - 4, s - 4, 4); noShad(ctx);
            ctx.fillStyle = C.wardrobeDoor; rr(ctx, x + 3, y + 3, s * .44, s - 6, 3);
            ctx.fillStyle = C.wardrobeDoor; rr(ctx, x + s * .52, y + 3, s * .44, s - 6, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, x + 3, y + 3, s * .44, s * .18, 3); rr(ctx, x + s * .52, y + 3, s * .44, s * .18, 3);
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, x + s * .43, y + 3, s * .08, s - 6, 0);
            ctx.fillStyle = '#bcaaa4'; ctx.beginPath(); ctx.arc(x + s * .43, y + s * .5, s * .055, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + s * .57, y + s * .5, s * .055, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s * .41, y + s * .48, s * .02, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + s * .55, y + s * .48, s * .02, 0, Math.PI * 2); ctx.fill();
            break;
        case 'shelf':
            shad(ctx); ctx.fillStyle = C.shelf; rr(ctx, x + 2, y + 2, s - 4, s - 4, 4); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, x + 2, y + 2, s - 4, s * .12, 4);
            [0.1, 0.38, 0.63].forEach((fy, ri) => {
                const nb = 4 + ri, bw = (s - 10) / nb;
                C.book.slice(0, nb).forEach((bc, i) => {
                    ctx.fillStyle = bc; rr(ctx, x + 5 + i * bw, y + fy * s + 1, bw - 2, s * .22, 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, x + 5 + i * bw, y + fy * s + 1, bw * .4, s * .08, 2);
                });
                ctx.fillStyle = 'rgba(0,0,0,0.15)'; rr(ctx, x + 3, y + (fy + .24) * s, s - 6, s * .03, 0);
            });
            break;
        case 'plant':
            shad(ctx); ctx.fillStyle = '#8d6e63'; rr(ctx, x + s * .28, y + s * .62, s * .44, s * .33, 4); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .3, y + s * .63, s * .2, s * .1, 3);
            shad(ctx, .2); ctx.fillStyle = C.plantDark; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .43, s * .35, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = C.plant; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .4, s * .3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.treeLight; ctx.beginPath(); ctx.arc(x + s * .37, y + s * .33, s * .18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x + s * .34, y + s * .3, s * .07, 0, Math.PI * 2); ctx.fill();
            break;
        case 'plant2':
            ctx.fillStyle = '#8d6e63'; rr(ctx, x + s * .36, y + s * .7, s * .28, s * .27, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .38, y + s * .71, s * .12, s * .08, 2);
            ctx.fillStyle = C.plantDark; ctx.fillRect(x + s * .46, y + s * .35, s * .08, s * .38);
            shad(ctx, .2); ctx.fillStyle = C.plant; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .28, s * .26, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = C.treeLight; ctx.beginPath(); ctx.arc(x + s * .4, y + s * .22, s * .14, 0, Math.PI * 2); ctx.fill();
            break;
        case 'table':
            shad(ctx); ctx.fillStyle = C.table; rr(ctx, x + 4, y + 4, s - 8, s - 8, 5); noShad(ctx);
            ctx.fillStyle = C.tableTop; rr(ctx, x + 4, y + 4, s - 8, s * .36, 5);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, x + 5, y + 5, s - 10, s * .12, 4);
            break;
        case 'table_round': {
            const tr = ctx.createRadialGradient(x + s * .4, y + s * .4, 0, x + s * .5, y + s * .5, s * .42);
            tr.addColorStop(0, C.tableTop); tr.addColorStop(1, C.table);
            shad(ctx); ctx.fillStyle = tr; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .4, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x + s * .42, y + s * .4, s * .15, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'chair':
            shad(ctx);
            ctx.fillStyle = C.chair; rr(ctx, x + s * .2, y + s * .08, s * .6, s * .36, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + s * .2, y + s * .08, s * .6, s * .12, 4);
            ctx.fillStyle = C.chairSeat; rr(ctx, x + s * .14, y + s * .48, s * .72, s * .36, 4);
            noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .16, y + s * .5, s * .4, s * .1, 3);
            ctx.fillStyle = '#3e2723';[[.18, .84], [.64, .84]].forEach(([fx, fy]) => rr(ctx, x + fx * s, y + fy * s, s * .15, s * .13, 2));
            break;
        case 'sofa':
            shad(ctx); ctx.fillStyle = C.sofaDark; rr(ctx, x + 2, y + s * .1, s - 4, s * .84, 5); noShad(ctx);
            ctx.fillStyle = C.sofa; rr(ctx, x + 4, y + s * .35, s - 8, s * .44, 4);
            ctx.fillStyle = C.sofaCushion;
            rr(ctx, x + 6, y + s * .38, s * .37, s * .36, 4); rr(ctx, x + s * .54, y + s * .38, s * .37, s * .36, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, x + 6, y + s * .38, s * .37, s * .1, 4); rr(ctx, x + s * .54, y + s * .38, s * .37, s * .1, 4);
            ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x + s * .5, y + s * .36, 2, s * .42); // cushion divider
            break;
        case 'sofa_corner':
            shad(ctx); ctx.fillStyle = C.sofaDark; rr(ctx, x + 2, y + 2, s - 4, s - 4, 5); noShad(ctx);
            ctx.fillStyle = C.couch2; rr(ctx, x + 4, y + 4, s - 8, s - 8, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + 4, y + 4, s - 8, s * .18, 4);
            break;
        case 'counter':
            shad(ctx); ctx.fillStyle = C.counter; rr(ctx, x + 2, y + 2, s - 4, s - 4, 4); noShad(ctx);
            ctx.fillStyle = C.counterTop; rr(ctx, x + 2, y + 2, s - 4, s * .3, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x + 3, y + 3, s * .5, s * .1, 3);
            ctx.fillStyle = '#7c6040'; rr(ctx, x + s * .08, y + s * .4, s * .28, s * .42, 3); rr(ctx, x + s * .43, y + s * .4, s * .47, s * .42, 3);
            break;
        case 'counter_sink':
            shad(ctx); ctx.fillStyle = C.counter; rr(ctx, x + 2, y + 2, s - 4, s - 4, 4); noShad(ctx);
            ctx.fillStyle = C.counterTop; rr(ctx, x + 2, y + 2, s - 4, s * .3, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x + 3, y + 3, s * .5, s * .1, 3);
            ctx.fillStyle = C.sink; rr(ctx, x + s * .14, y + s * .37, s * .72, s * .47, 4);
            ctx.fillStyle = 'rgba(144,202,249,0.5)'; rr(ctx, x + s * .16, y + s * .39, s * .68, s * .2, 3);
            ctx.fillStyle = '#607d8b'; rr(ctx, x + s * .42, y + s * .26, s * .16, s * .18, 3);
            break;
        case 'bath': {
            shad(ctx, .4);
            ctx.fillStyle = '#78909c'; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .44, s * .44, 0, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = C.bath; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .38, s * .38, 0, 0, Math.PI * 2); ctx.fill();
            const bg = ctx.createRadialGradient(x + s * .42, y + s * .42, 0, x + s * .5, y + s * .5, s * .38);
            bg.addColorStop(0, 'rgba(255,255,255,0.4)'); bg.addColorStop(1, 'rgba(144,202,249,0)');
            ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .38, s * .38, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5b8fa8'; rr(ctx, x + s * .36, y + s * .1, s * .28, s * .16, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + s * .44, y + s * .1, s * .08, s * .06);
            break;
        }
        case 'sink':
            shad(ctx); ctx.fillStyle = '#90a4ae'; rr(ctx, x + s * .08, y + s * .13, s * .84, s * .74, 5); noShad(ctx);
            ctx.fillStyle = C.sink; rr(ctx, x + s * .12, y + s * .22, s * .76, s * .54, 4);
            ctx.fillStyle = 'rgba(144,202,249,0.45)'; rr(ctx, x + s * .14, y + s * .28, s * .72, s * .22, 3);
            ctx.fillStyle = '#607d8b'; rr(ctx, x + s * .42, y + s * .08, s * .16, s * .2, 3);
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, x + s * .44, y + s * .09, s * .06, s * .1, 2);
            break;
        case 'stove':
            shad(ctx); ctx.fillStyle = '#546e7a'; rr(ctx, x + 3, y + 3, s - 6, s - 6, 4); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, x + 3, y + 3, s - 6, s * .15, 4);
            [[.25, .26], [.65, .26], [.25, .65], [.65, .65]].forEach(([fx, fy]) => {
                const bg = ctx.createRadialGradient(x + fx * s, y + fy * s, 0, x + fx * s, y + fy * s, s * .13);
                bg.addColorStop(0, '#455a64'); bg.addColorStop(1, C.burner);
                ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x + fx * s, y + fy * s, s * .13, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.arc(x + fx * s, y + fy * s, s * .07, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x + fx * s - s * .04, y + fy * s - s * .04, s * .03, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 'barrel': {
            shad(ctx, .35); const bg2 = ctx.createLinearGradient(x + s * .15, y, x + s * .85, y);
            bg2.addColorStop(0, '#5d4037'); bg2.addColorStop(0.4, C.barrel); bg2.addColorStop(1, '#4e342e');
            ctx.fillStyle = bg2; ctx.beginPath(); ctx.ellipse(x + s * .5, y + s * .5, s * .36, s * .43, 0, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            [.22, .5, .78].forEach(fy => {
                ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2; ctx.beginPath();
                ctx.ellipse(x + s * .5, y + fy * s, s * .36, s * .1, 0, 0, Math.PI * 2); ctx.stroke();
            });
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(x + s * .38, y + s * .32, s * .12, s * .18, -.4, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'rug':
            shad(ctx, .18); ctx.fillStyle = C.rug; rr(ctx, x + 4, y + 4, s - 8, s - 8, 5); noShad(ctx);
            ctx.strokeStyle = '#5c6bc0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 8, y + 8, s - 16, s - 16, 3); ctx.stroke();
            ctx.strokeStyle = 'rgba(121,134,203,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 11, y + 11, s - 22, s - 22, 2); ctx.stroke();
            break;
        case 'rug2':
            shad(ctx, .18); ctx.fillStyle = C.rug2; rr(ctx, x + 4, y + 4, s - 8, s - 8, 5); noShad(ctx);
            ctx.strokeStyle = '#e91e63'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 8, y + 8, s - 16, s - 16, 3); ctx.stroke();
            ctx.strokeStyle = 'rgba(233,30,99,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + 11, y + 11, s - 22, s - 22, 2); ctx.stroke();
            break;
        case 'mat':
            shad(ctx, .2); ctx.fillStyle = C.mat; rr(ctx, x + 3, y + s * .3, s - 6, s * .4, 4); noShad(ctx);
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(x + 5, y + s * .33, s - 10, s * .34, 3); ctx.stroke();
            break;
        case 'tree': {
            // shadow on ground
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x + s * .54, y + s * .88, s * .28, s * .1, 0, 0, Math.PI * 2); ctx.fill();
            // trunk
            const tg = ctx.createLinearGradient(x + s * .38, y, x + s * .62, y);
            tg.addColorStop(0, '#5d4037'); tg.addColorStop(0.5, '#8d6e63'); tg.addColorStop(1, '#5d4037');
            ctx.fillStyle = tg; rr(ctx, x + s * .4, y + s * .58, s * .2, s * .38, 3);
            // canopy layers
            shad(ctx, .3); ctx.fillStyle = C.treeDark; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .38, s * .4, 0, Math.PI * 2); ctx.fill();
            noShad(ctx);
            ctx.fillStyle = C.tree; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .34, s * .34, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.treeLight; ctx.beginPath(); ctx.arc(x + s * .38, y + s * .26, s * .2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x + s * .35, y + s * .22, s * .09, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'bench':
            shad(ctx);
            ctx.fillStyle = C.bench; rr(ctx, x + s * .06, y + s * .34, s * .88, s * .22, 4);
            ctx.fillStyle = C.benchtop; rr(ctx, x + s * .06, y + s * .54, s * .88, s * .2, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, x + s * .06, y + s * .54, s * .5, s * .08, 4);
            noShad(ctx);
            [[.08, .74], [.76, .74]].forEach(([fx, fy]) => { ctx.fillStyle = C.bench; rr(ctx, x + fx * s, y + fy * s, s * .14, s * .22, 3); });
            break;
        case 'flower':
            C.flower.slice(0, 3).forEach((fc, i) => {
                const fx = x + [.3, .5, .7][i] * s, fy = y + [.52, .36, .62][i] * s;
                shad(ctx, .2); ctx.fillStyle = fc; ctx.beginPath(); ctx.arc(fx, fy, s * .15, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
                ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(fx - s * .04, fy - s * .05, s * .06, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx, fy, s * .04, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 'fountain': {
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + s * .52, y + s * .54, s * .44, s * .14, 0, 0, Math.PI * 2); ctx.fill();
            shad(ctx); ctx.fillStyle = C.fountainRing; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .44, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            const fg = ctx.createRadialGradient(x + s * .5, y + s * .5, s * .1, x + s * .5, y + s * .5, s * .38);
            fg.addColorStop(0, '#64b5f6'); fg.addColorStop(1, '#29b6f6');
            ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .36, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
            [.14, .22, .3].forEach(r => { ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, r * s, 0, Math.PI * 2); ctx.stroke(); });
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .5, s * .07, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .48, s * .03, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'lamp':
            ctx.fillStyle = '#455a64'; rr(ctx, x + s * .44, y + s * .24, s * .12, s * .62, 3);
            ctx.fillStyle = '#37474f'; rr(ctx, x + s * .28, y + s * .84, s * .44, s * .1, 3);
            // glow halo
            const lg = ctx.createRadialGradient(x + s * .5, y + s * .2, 0, x + s * .5, y + s * .2, s * .32);
            lg.addColorStop(0, 'rgba(255,249,196,0.7)'); lg.addColorStop(1, 'rgba(255,249,196,0)');
            ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .2, s * .32, 0, Math.PI * 2); ctx.fill();
            shad(ctx, .5); ctx.fillStyle = C.lampGlow; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .2, s * .2, 0, Math.PI * 2); ctx.fill(); noShad(ctx);
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s * .5, y + s * .18, s * .08, 0, Math.PI * 2); ctx.fill();
            break;
        case 'vending':
            shad(ctx); ctx.fillStyle = '#1565c0'; rr(ctx, x + s * .08, y + s * .04, s * .84, s * .9, 6); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, x + s * .08, y + s * .04, s * .84, s * .25, 6);
            ctx.fillStyle = '#e3f2fd'; rr(ctx, x + s * .16, y + s * .12, s * .68, s * .52, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; rr(ctx, x + s * .18, y + s * .14, s * .3, s * .48, 3);
            ['#ef5350', '#43a047', '#ffd740'].forEach((vc, i) => {
                ctx.fillStyle = vc; ctx.beginPath(); ctx.arc(x + s * .5, y + (0.74 + i * .06) * s, s * .055, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(x + s * .46, y + (0.72 + i * .06) * s, s * .02, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 'sign':
            shad(ctx); ctx.fillStyle = '#e65100'; rr(ctx, x + s * .08, y + s * .12, s * .84, s * .52, 5); noShad(ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, x + s * .08, y + s * .12, s * .84, s * .15, 5);
            ctx.fillStyle = '#fff'; rr(ctx, x + s * .13, y + s * .18, s * .74, s * .38, 4);
            ctx.fillStyle = '#ff6d00'; rr(ctx, x + s * .44, y + s * .64, s * .12, s * .24, 3);
            ctx.fillStyle = '#795548'; rr(ctx, x + s * .26, y + s * .88, s * .48, s * .08, 2);
            break;
    }
    ctx.restore();
}

// ── Character (animated, 4-direction) ───────────────────────
function drawCharacter(ctx, px, py, cs, status, dir = 'down') {
    const s = cs; ctx.save();
    const isMoving = status === 'moving';
    const t = isMoving ? (Date.now() / 180) : 0;
    const swing = isMoving ? Math.sin(t) : 0;          // -1 to +1
    const bob = isMoving ? Math.abs(Math.sin(t)) * s * .035 : 0;
    const py2 = py - bob;

    // Ground shadow (stretches with stride)
    const sg = ctx.createRadialGradient(px + s * .5, py + s * .94, 0, px + s * .5, py + s * .94, s * .32);
    sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.beginPath();
    ctx.ellipse(px + s * .5, py + s * .93, s * .28 + Math.abs(swing) * s * .04, s * .075, 0, 0, Math.PI * 2); ctx.fill();

    if (dir === 'left' || dir === 'right') {
        // ── SIDE VIEW ──
        ctx.save();
        if (dir === 'left') { ctx.translate(px + s, py2); ctx.scale(-1, 1); }
        else ctx.translate(px, py2);
        // rear limbs (darker, behind body)
        ctx.fillStyle = '#1a237e'; rr(ctx, s * .42 - swing * s * .08, s * .58 + Math.max(0, swing) * s * .06, s * .18, s * .3, 3);
        ctx.fillStyle = '#111'; rr(ctx, s * .4 - swing * s * .08, s * .86 + Math.max(0, swing) * s * .06, s * .22, s * .1, 3);
        ctx.fillStyle = '#880e4f'; rr(ctx, s * .68, s * .38 + swing * s * .06, s * .12, s * .22, 4);
        // body
        const bc = isMoving ? '#e91e63' : '#c2185b';
        shad(ctx, .3); ctx.fillStyle = bc; rr(ctx, s * .2, s * .36, s * .6, s * .28, s * .07); noShad(ctx);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, s * .2, s * .36, s * .6, s * .1, s * .07);
        // front leg
        const flx = s * .4 + swing * s * .08, fly = s * .56 - Math.max(0, -swing) * s * .06;
        ctx.fillStyle = '#283593'; rr(ctx, flx, fly, s * .2, s * .32, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, flx, fly, s * .2, s * .08, 3);
        ctx.fillStyle = '#1a1a2e'; rr(ctx, flx - s * .02, fly + s * .29, s * .24, s * .1, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, flx, fly + s * .3, s * .1, s * .04, 2);
        // front arm
        ctx.fillStyle = bc; rr(ctx, s * .12, s * .37 - swing * s * .06, s * .12, s * .22, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, s * .12, s * .37 - swing * s * .06, s * .12, s * .07, 4);
        // neck + head
        ctx.fillStyle = '#ffcc80'; rr(ctx, s * .38, s * .27, s * .14, s * .1, 3);
        shad(ctx, .25); ctx.fillStyle = '#ffcc80'; rr(ctx, s * .22, s * .05, s * .48, s * .26, s * .12); noShad(ctx);
        ctx.fillStyle = 'rgba(255,220,150,0.5)'; rr(ctx, s * .24, s * .06, s * .44, s * .09, s * .1);
        // hair
        shad(ctx, .2); ctx.fillStyle = '#4e342e'; rr(ctx, s * .2, s * .02, s * .52, s * .15, s * .1); noShad(ctx);
        ctx.fillStyle = '#3e2723'; rr(ctx, s * .7, s * .04, s * .06, s * .24, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, s * .22, s * .03, s * .26, s * .06, 4);
        // side eye
        ctx.fillStyle = '#fff'; rr(ctx, s * .56, s * .12, s * .1, s * .08, 2);
        ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(s * .64, s * .16, s * .035, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * .625, s * .145, s * .015, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,100,0.3)'; ctx.beginPath(); ctx.ellipse(s * .56, s * .2, s * .07, s * .04, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    } else {
        // ── FRONT (down) / BACK (up) VIEW ──
        const isFront = (dir !== 'up');
        // legs alternating
        const lx = px + s * .18 + swing * s * .07, rx = px + s * .56 - swing * s * .07;
        const lyOff = swing > 0 ? -swing * s * .04 : 0, ryOff = swing < 0 ? swing * s * .04 : 0;
        ctx.fillStyle = '#283593';
        rr(ctx, lx, py2 + s * .62, s * .22, s * .28, 3); rr(ctx, rx, py2 + s * .62, s * .22, s * .28, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        rr(ctx, lx, py2 + s * .62, s * .22, s * .08, 3); rr(ctx, rx, py2 + s * .62, s * .22, s * .08, 3);
        // shoes
        ctx.fillStyle = '#1a1a2e';
        rr(ctx, lx - s * .02, py2 + s * .87 + lyOff, s * .28, s * .1, 3); rr(ctx, rx - s * .02, py2 + s * .87 + ryOff, s * .28, s * .1, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        rr(ctx, lx, py2 + s * .87 + lyOff, s * .1, s * .05, 2); rr(ctx, rx, py2 + s * .87 + ryOff, s * .1, s * .05, 2);
        // body
        const bc = isMoving ? '#e91e63' : '#c2185b';
        shad(ctx, .3); ctx.fillStyle = bc; rr(ctx, px + s * .16, py2 + s * .37, s * .68, s * .3, s * .07); noShad(ctx);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; rr(ctx, px + s * .16, py2 + s * .37, s * .68, s * .1, s * .07);
        // arms swing opposite to legs
        ctx.fillStyle = bc;
        rr(ctx, px + s * .04 + swing * s * .05, py2 + s * .39, s * .14, s * .22, 4);
        rr(ctx, px + s * .82 - swing * s * .05, py2 + s * .39, s * .14, s * .22, 4);
        // neck
        ctx.fillStyle = '#ffcc80'; rr(ctx, px + s * .42, py2 + s * .29, s * .16, s * .11, 3);
        // head
        shad(ctx, .25); ctx.fillStyle = '#ffcc80'; rr(ctx, px + s * .24, py2 + s * .06, s * .52, s * .28, s * .12); noShad(ctx);
        ctx.fillStyle = 'rgba(255,220,150,0.5)'; rr(ctx, px + s * .26, py2 + s * .07, s * .48, s * .1, s * .1);
        // hair
        shad(ctx, .2); ctx.fillStyle = '#4e342e'; rr(ctx, px + s * .22, py2 + s * .03, s * .56, s * .16, s * .1); noShad(ctx);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, px + s * .25, py2 + s * .04, s * .28, s * .06, 4);
        ctx.fillStyle = '#3e2723'; rr(ctx, px + s * .22, py2 + s * .1, s * .1, s * .1, 3);
        if (isFront) {
            ctx.fillStyle = '#fff'; rr(ctx, px + s * .33, py2 + s * .13, s * .1, s * .08, 2); rr(ctx, px + s * .55, py2 + s * .13, s * .1, s * .08, 2);
            ctx.fillStyle = '#212121';
            ctx.beginPath(); ctx.arc(px + s * .38, py2 + s * .17, s * .035, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + s * .6, py2 + s * .17, s * .035, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(px + s * .365, py2 + s * .155, s * .015, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + s * .585, py2 + s * .155, s * .015, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,120,100,0.35)';
            ctx.beginPath(); ctx.ellipse(px + s * .3, py2 + s * .2, s * .08, s * .05, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(px + s * .7, py2 + s * .2, s * .08, s * .05, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#c2796a'; ctx.lineWidth = 1.5; ctx.beginPath();
            ctx.arc(px + s * .5, py2 + s * .22, s * .06, 0.2, Math.PI - .2); ctx.stroke();
        } else {
            // back of head
            ctx.fillStyle = '#3e2723'; rr(ctx, px + s * .28, py2 + s * .1, s * .44, s * .14, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, px + s * .3, py2 + s * .12, s * .2, s * .05, 3);
        }
    }
    // Status ring
    if (status !== 'idle') {
        ctx.strokeStyle = status === 'moving' ? 'rgba(52,211,153,0.85)' : 'rgba(239,68,68,0.85)';
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px + s * .5, py + s * .5, s * .49, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = status === 'moving' ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)';
        ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(px + s * .5, py + s * .5, s * .49, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
}


// ── Scene furniture (精装修) ───────────────────────────────────
const FURN = [
    // ═══ HOME BEDROOM (cols 3-9, rows 4-9) ═══
    // bed (2-wide) along north wall
    { t: 'bed2', c: 3, r: 4 }, { t: 'bed2', c: 4, r: 4 },
    // bedside lamps
    { t: 'lamp', c: 2, r: 4 }, { t: 'lamp', c: 5, r: 4 }, // virtual since walls, use col 3 area
    // wardrobe
    { t: 'wardrobe', c: 8, r: 4 }, { t: 'wardrobe', c: 9, r: 4 },
    // shelf / bookcase
    { t: 'shelf', c: 3, r: 8 }, { t: 'shelf', c: 4, r: 8 },
    // desk + chair
    { t: 'desk', c: 7, r: 6 }, { t: 'chair', c: 7, r: 7 },
    // bedside plant
    { t: 'plant', c: 9, r: 8 },
    // rug
    { t: 'rug2', c: 5, r: 6 }, { t: 'rug2', c: 6, r: 6 }, { t: 'rug2', c: 5, r: 7 }, { t: 'rug2', c: 6, r: 7 },
    // doormat
    { t: 'mat', c: 7, r: 12 },

    // ═══ HOME LIVING ROOM (cols 3-14, rows 4-12, right half) ═══
    // sofa set (L-shape)
    { t: 'sofa', c: 10, r: 5 }, { t: 'sofa', c: 11, r: 5 }, { t: 'sofa', c: 12, r: 5 },
    { t: 'sofa_corner', c: 13, r: 5 },
    { t: 'sofa', c: 13, r: 6 },
    // coffee table
    { t: 'table_round', c: 11, r: 7 }, { t: 'table_round', c: 12, r: 7 },
    // TV across from sofa
    { t: 'tv', c: 10, r: 4 }, { t: 'tv', c: 11, r: 4 },
    // shelf on east wall
    { t: 'shelf', c: 13, r: 8 }, { t: 'shelf', c: 13, r: 9 },
    // plant in corner
    { t: 'plant2', c: 13, r: 11 }, { t: 'plant', c: 10, r: 11 },
    // rug under seating
    { t: 'rug', c: 11, r: 6 }, { t: 'rug', c: 12, r: 6 },
    // lamp
    { t: 'lamp', c: 10, r: 10 },

    // ═══ HOME KITCHEN (cols 3-8, rows 10-12) ═══
    // counter along south wall
    { t: 'counter', c: 3, r: 12 }, { t: 'counter', c: 4, r: 12 }, { t: 'counter', c: 5, r: 12 },
    { t: 'stove', c: 6, r: 12 }, { t: 'counter_sink', c: 7, r: 12 },
    // dining table + chairs
    { t: 'table', c: 3, r: 10 }, { t: 'table', c: 4, r: 10 },
    { t: 'chair', c: 3, r: 9 }, { t: 'chair', c: 4, r: 9 }, { t: 'chair', c: 5, r: 9 },
    { t: 'chair', c: 3, r: 11 }, { t: 'chair', c: 5, r: 11 },
    // plant
    { t: 'plant2', c: 8, r: 10 },

    // ═══ BATH (cols 18-25, rows 4-9) ═══
    { t: 'bath', c: 18, r: 5 }, { t: 'bath', c: 19, r: 5 },
    { t: 'sink', c: 21, r: 4 }, { t: 'sink', c: 23, r: 4 },
    { t: 'counter_sink', c: 25, r: 4 },
    // bath mat
    { t: 'mat', c: 18, r: 7 }, { t: 'mat', c: 19, r: 7 },
    // plant
    { t: 'plant', c: 25, r: 8 }, { t: 'plant2', c: 25, r: 7 },

    // ═══ KITCHEN (cols 27-33, rows 4-12) ═══
    // counter + appliances along west wall
    { t: 'counter', c: 27, r: 4 }, { t: 'stove', c: 28, r: 4 }, { t: 'counter', c: 29, r: 4 },
    { t: 'counter', c: 30, r: 4 }, { t: 'counter', c: 31, r: 4 }, { t: 'counter', c: 32, r: 4 },
    { t: 'counter_sink', c: 33, r: 4 },
    // island / dining table
    { t: 'table', c: 28, r: 7 }, { t: 'table', c: 29, r: 7 }, { t: 'table', c: 30, r: 7 },
    { t: 'chair', c: 28, r: 6 }, { t: 'chair', c: 29, r: 6 }, { t: 'chair', c: 30, r: 6 }, { t: 'chair', c: 31, r: 6 },
    { t: 'chair', c: 28, r: 8 }, { t: 'chair', c: 30, r: 8 },
    // shelf on east wall
    { t: 'shelf', c: 33, r: 7 }, { t: 'shelf', c: 33, r: 8 },
    // barrel (storage)
    { t: 'barrel', c: 33, r: 11 }, { t: 'barrel', c: 32, r: 11 },
    // rug
    { t: 'rug', c: 29, r: 9 }, { t: 'rug', c: 30, r: 9 },
    // plant
    { t: 'plant', c: 33, r: 11 }, { t: 'plant2', c: 27, r: 11 },
    // mat at door
    { t: 'mat', c: 24, r: 12 },

    // ═══ PARK (cols 0-12, rows 17-24) ═══
    { t: 'tree', c: 1, r: 17 }, { t: 'tree', c: 4, r: 17 }, { t: 'tree', c: 7, r: 17 }, { t: 'tree', c: 10, r: 17 },
    { t: 'tree', c: 1, r: 23 }, { t: 'tree', c: 4, r: 24 }, { t: 'tree', c: 8, r: 24 }, { t: 'tree', c: 11, r: 23 },
    { t: 'tree', c: 0, r: 20 }, { t: 'tree', c: 12, r: 21 },
    { t: 'fountain', c: 5, r: 20 }, { t: 'fountain', c: 6, r: 20 },
    { t: 'bench', c: 3, r: 19 }, { t: 'bench', c: 8, r: 19 },
    { t: 'bench', c: 3, r: 22 }, { t: 'bench', c: 8, r: 22 },
    { t: 'flower', c: 1, r: 19 }, { t: 'flower', c: 10, r: 19 },
    { t: 'flower', c: 2, r: 22 }, { t: 'flower', c: 9, r: 22 },
    { t: 'flower', c: 4, r: 23 }, { t: 'flower', c: 7, r: 23 },
    { t: 'flower', c: 1, r: 21 }, { t: 'flower', c: 11, r: 21 },

    // ═══ MALL interior (cols 14-18, rows 18-23) ═══
    { t: 'shelf', c: 14, r: 18 }, { t: 'shelf', c: 15, r: 18 }, { t: 'shelf', c: 16, r: 18 },
    { t: 'shelf', c: 14, r: 20 }, { t: 'shelf', c: 15, r: 20 },
    { t: 'vending', c: 17, r: 18 }, { t: 'vending', c: 18, r: 18 },
    { t: 'barrel', c: 17, r: 20 }, { t: 'barrel', c: 18, r: 20 },
    { t: 'counter', c: 14, r: 22 }, { t: 'counter', c: 15, r: 22 }, { t: 'counter', c: 16, r: 22 },
    { t: 'plant', c: 18, r: 22 }, { t: 'sign', c: 14, r: 17 },

    // ═══ CITY HALL interior (cols 22-27, rows 18-23) ═══
    { t: 'desk', c: 22, r: 18 }, { t: 'desk', c: 24, r: 18 }, { t: 'desk', c: 26, r: 18 },
    { t: 'chair', c: 22, r: 19 }, { t: 'chair', c: 24, r: 19 }, { t: 'chair', c: 26, r: 19 },
    { t: 'bench', c: 22, r: 21 }, { t: 'bench', c: 22, r: 22 },
    { t: 'bench', c: 25, r: 21 }, { t: 'bench', c: 25, r: 22 },
    { t: 'plant', c: 27, r: 18 }, { t: 'plant2', c: 22, r: 23 },
    { t: 'table', c: 24, r: 22 }, { t: 'chair', c: 23, r: 22 }, { t: 'chair', c: 25, r: 22 },
    { t: 'sign', c: 24, r: 17 },

    // ═══ COFFEE SHOP interior (cols 31-35, rows 18-23) ═══
    // counter along back wall
    { t: 'counter', c: 31, r: 23 }, { t: 'counter', c: 32, r: 23 }, { t: 'counter', c: 33, r: 23 }, { t: 'counter', c: 34, r: 23 },
    // tables + chairs (3 tables)
    { t: 'table_round', c: 31, r: 19 }, { t: 'chair', c: 30, r: 19 }, { t: 'chair', c: 32, r: 19 }, { t: 'chair', c: 31, r: 20 },
    { t: 'table_round', c: 33, r: 19 }, { t: 'chair', c: 34, r: 19 }, { t: 'chair', c: 33, r: 20 },
    { t: 'table_round', c: 32, r: 21 }, { t: 'chair', c: 31, r: 21 }, { t: 'chair', c: 33, r: 21 }, { t: 'chair', c: 32, r: 22 },
    // plants
    { t: 'plant2', c: 35, r: 18 }, { t: 'plant', c: 35, r: 22 },
    { t: 'rug', c: 32, r: 20 }, { t: 'rug', c: 33, r: 20 },
    { t: 'sign', c: 32, r: 17 },

    // ═══ MARKET interior (cols 39-45, rows 18-23) ═══
    // stalls / barrels
    { t: 'barrel', c: 39, r: 18 }, { t: 'barrel', c: 41, r: 18 }, { t: 'barrel', c: 43, r: 18 }, { t: 'barrel', c: 45, r: 18 },
    { t: 'barrel', c: 40, r: 21 }, { t: 'barrel', c: 42, r: 21 }, { t: 'barrel', c: 44, r: 21 },
    { t: 'shelf', c: 39, r: 20 }, { t: 'shelf', c: 41, r: 20 }, { t: 'shelf', c: 43, r: 20 },
    { t: 'counter', c: 39, r: 22 }, { t: 'counter', c: 40, r: 22 }, { t: 'counter', c: 41, r: 22 },
    { t: 'counter', c: 43, r: 22 }, { t: 'counter', c: 44, r: 22 }, { t: 'counter', c: 45, r: 22 },
    { t: 'flower', c: 45, r: 20 }, { t: 'flower', c: 39, r: 23 }, { t: 'flower', c: 45, r: 23 },
    { t: 'plant', c: 45, r: 19 }, { t: 'sign', c: 40, r: 17 },
];

// Outdoor trees
const TREES = [
    [0, 0], [3, 0], [7, 0], [12, 0], [17, 0], [22, 0], [27, 0], [32, 0], [37, 0], [42, 0], [47, 0],
    [0, 27], [4, 27], [9, 27], [14, 27], [19, 27], [24, 27], [29, 27], [34, 27], [39, 27], [44, 27], [47, 27],
    [0, 3], [0, 7], [0, 11], [47, 4], [47, 8], [47, 12],
    [35, 4], [36, 8], [35, 11], [36, 4], [35, 8],
];

// ── Main draw ─────────────────────────────────────────────────
function drawScene(ctx, W, H, zoom, offset, pois, cCol, cRow, cStatus, cLabel, hovered, cDir) {
    const cs = CELL * zoom, ox = offset.x, oy = offset.y;
    const gc = (c, r) => ({ x: Math.round(ox + c * cs), y: Math.round(oy + r * cs) });
    const fr = (c, r, w, h, col) => {
        const { x, y } = gc(c, r);
        if (x + w * cs < 0 || y + h * cs < 0 || x > W || y > H) return;
        ctx.fillStyle = col; ctx.fillRect(x, y, w * cs, h * cs);
    };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H);

    // ── Base grass ──
    fr(0, 0, COLS, ROWS, C.grass);
    for (let r = 0; r < ROWS; r += 2) for (let c = r % 2; c < COLS; c += 2) fr(c, r, 1, 1, C.grassAlt);

    // ── Sidewalks ──
    [2, 14, 16, 25].forEach(r => fr(0, r, COLS, 1, C.sidewalk));

    // ── Roads ──
    [15, 26].forEach(r => {
        fr(0, r, COLS, 1, C.road);
        ctx.fillStyle = C.roadLine;
        for (let c = 0; c < COLS; c += 2) { const { x, y } = gc(c, r); ctx.fillRect(x + cs * .1, y + cs * .46, cs * .8, cs * .08); }
        // edges
        const { y: yt } = gc(0, r); const { y: yb } = gc(0, r + 1);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(ox, yt, COLS * cs, cs * .04);
        ctx.fillRect(ox, yb - cs * .04, COLS * cs, cs * .04);
    });

    // ── Path col 16 (between home and bath) ──
    fr(16, 3, 1, 11, C.sidewalk);

    // ── Garden / grass between home and bath building ──
    for (let r = 3; r < 14; r++) {
        fr(35, r, 1, 1, C.sidewalk); // right corridor
    }

    // ── HOME exterior + interior rooms ──
    fr(2, 3, 14, 11, C.homeWall);
    // bedroom (west half of house)
    for (let r = 4; r < 13; r++) for (let c = 3; c < 10; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.bedroomFloor : C.bedroomAlt);
    // living room (east half)
    for (let r = 4; r < 13; r++) for (let c = 10; c < 15; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.livingFloor : C.livingAlt);
    // kitchen (bottom-west corner, same as bedroom floor but lighter)
    for (let r = 10; r < 13; r++) for (let c = 3; c < 9; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.kitchenFloor : C.kitchenAlt);
    // corridor / divider line
    fr(9, 4, 1, 9, 'rgba(0,0,0,0.08)');
    fr(3, 10, 6, 1, 'rgba(0,0,0,0.08)');
    // door trim
    fr(7, 13, 1, 1, C.homeTrim);

    // ── BATH/KITCHEN exterior ──
    fr(17, 3, 18, 11, C.bathWall);
    // bath zone (west)
    for (let r = 4; r < 13; r++) for (let c = 18; c < 27; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.bathFloor : C.bathAlt);
    // kitchen zone (east)
    for (let r = 4; r < 13; r++) for (let c = 27; c < 34; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.kitchenFloor : C.kitchenAlt);
    // divider
    fr(26, 4, 1, 9, 'rgba(0,0,0,0.12)');
    // door trim
    fr(24, 13, 1, 1, C.bathTrim);

    // ── PARK ──
    for (let r = 17; r < 25; r++) for (let c = 0; c < 13; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? C.parkGrass : C.parkAlt);
    fr(5, 17, 2, 8, C.parkPath);  // vertical path
    fr(0, 20, 13, 1, C.parkPath); // horizontal path

    // ── COMMERCIAL buildings ──
    const commercialDefs = [
        { x: 13, y: 17, w: 7, h: 8, floor: C.mallFloor, alt: C.mallAlt, wall: C.mallWall, trim: C.mallTrim || C.mallWall },
        { x: 21, y: 17, w: 8, h: 8, floor: C.cityFloor, alt: C.cityAlt, wall: C.cityWall, trim: C.cityWall },
        { x: 30, y: 17, w: 7, h: 8, floor: C.cafeFloor, alt: C.cafeAlt, wall: C.cafeWall, trim: C.cafeWall },
        { x: 38, y: 17, w: 9, h: 8, floor: C.marketFloor, alt: C.marketAlt, wall: C.marketWall, trim: C.marketWall },
    ];
    commercialDefs.forEach(d => {
        fr(d.x, d.y, d.w, d.h, d.wall);
        for (let r = d.y + 1; r < d.y + d.h - 1; r++) for (let c = d.x + 1; c < d.x + d.w - 1; c++) fr(c, r, 1, 1, (r + c) % 2 === 0 ? d.floor : d.alt);
    });

    // ── Hover highlight ──
    if (hovered) {
        const { x, y } = gc(hovered.col, hovered.row);
        ctx.strokeStyle = 'rgba(255,220,80,.9)'; ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
        ctx.fillStyle = 'rgba(255,220,80,.1)'; ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
    }

    // ── Furniture ──
    FURN.forEach(f => {
        const { x, y } = gc(f.c, f.r);
        if (x + cs < 0 || y + cs < 0 || x > W || y > H) return;
        drawFurniture(ctx, f.t, f.c, f.r, cs);
    });

    // ── Outdoor trees ──
    TREES.forEach(([c, r]) => {
        const { x, y } = gc(c, r);
        if (x + cs < 0 || y + cs < 0 || x > W || y > H) return;
        drawFurniture(ctx, 'tree', c, r, cs);
    });

    // ── POI labels ──
    ctx.textBaseline = 'bottom';
    pois.forEach(p => {
        const { x, y } = gc(p.col, p.row);
        if (x > W + 200 || y > H + 40 || x + 300 < 0 || y + 40 < 0) return;
        const fs = Math.max(9, Math.min(13, zoom * 13));
        ctx.font = `bold ${fs}px sans-serif`;
        const tw = ctx.measureText(p.label).width + 10, bh = fs + 8;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.beginPath(); ctx.roundRect(x + 2, y - bh + 2, tw + 2, bh + 2, 5); ctx.fill();
        ctx.fillStyle = p.color || '#d97706';
        ctx.beginPath(); ctx.roundRect(x, y - bh, tw, bh, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillText(p.label, x + 5, y - 2);
    });

    // ── Character + bubble ──
    const { x: cx, y: cy } = gc(cCol, cRow);
    if (cx + cs > -cs && cy + cs > -cs && cx < W + cs && cy < H + cs) {
        drawCharacter(ctx, cx, cy, cs, cStatus, cDir);
        if (cLabel) {
            const fs2 = Math.max(8, Math.min(12, zoom * 11));
            ctx.font = `bold ${fs2}px sans-serif`;
            ctx.textBaseline = 'bottom';
            const tw2 = ctx.measureText(cLabel).width + 10, bh2 = fs2 + 8;
            const bx = cx + cs / 2 - tw2 / 2, by = cy - 5;
            ctx.fillStyle = 'rgba(0,0,0,.75)';
            ctx.beginPath(); ctx.roundRect(bx - 1, by - bh2 - 1, tw2 + 2, bh2 + 2, 6); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.roundRect(bx, by - bh2, tw2, bh2, 5); ctx.fill();
            ctx.fillStyle = '#1e293b'; ctx.fillText(cLabel, bx + 5, by - 2);
        }
    }
}

// ═════════════════════════════════════════════════════════════
//  COMPONENT
// ═════════════════════════════════════════════════════════════
const CHAR_INIT = { col: 7, row: 14 };
const STEP_MS = 150;

export default function GridWorldSimulator() {
    const canvasRef = useRef(null), animRef = useRef(null);
    const isDragging = useRef(false), lastMouse = useRef({ x: 0, y: 0 });
    const charPosRef = useRef(CHAR_INIT), stepTimerRef = useRef(null);
    const charDirRef = useRef('down'); // 'down' | 'up' | 'left' | 'right'

    const [zoom, setZoom] = useState(0.65);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(null);
    const [pois, setPois] = useState(loadPois);
    const [charPos, setCharPos] = useState(CHAR_INIT);
    const [charPath, setCharPath] = useState([]);
    const [charStatus, setCharStatus] = useState('idle');
    const [charLabel, setCharLabel] = useState(null);

    useEffect(() => { charPosRef.current = charPos; }, [charPos]);

    useEffect(() => {
        const onStorage = e => { if (e.key === POI_KEY || !e.key) setPois(loadPois()); };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Step engine
    useEffect(() => {
        if (!charPath.length) return;
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        stepTimerRef.current = setInterval(() => {
            setCharPath(prev => {
                if (!prev.length) { clearInterval(stepTimerRef.current); setCharStatus('idle'); setCharLabel(null); return prev; }
                const [nc, nr] = prev[0];
                // Track movement direction
                const { col: oc, row: or } = charPosRef.current;
                const dc = nc - oc, dr = nr - or;
                if (Math.abs(dc) > Math.abs(dr)) charDirRef.current = dc > 0 ? 'right' : 'left';
                else if (dr !== 0) charDirRef.current = dr > 0 ? 'down' : 'up';
                setCharPos({ col: nc, row: nr }); charPosRef.current = { col: nc, row: nr };
                const rest = prev.slice(1);
                if (!rest.length) {
                    clearInterval(stepTimerRef.current); setCharStatus('idle'); setCharLabel(null);
                    window.dispatchEvent(new CustomEvent('nanako:arrived', { detail: { pos: [nc, nr] } }));
                }
                return rest;
            });
        }, STEP_MS);
        return () => clearInterval(stepTimerRef.current);
    }, [charPath]);

    const handleMoveTo = useCallback((detail) => {
        let ec, er, label;
        if (detail.location) {
            const poi = findLocation(detail.location, pois);
            if (!poi) { window.dispatchEvent(new CustomEvent('nanako:blocked', { detail: { reason: 'unknown_location' } })); return; }
            ec = poi.col; er = poi.row; label = poi.label;
        } else if (Array.isArray(detail.target)) {
            [ec, er] = detail.target; label = `(${ec},${er})`;
        } else return;
        const { col: sc, row: sr } = charPosRef.current;
        const path = findPath(sc, sr, ec, er);
        if (!path) {
            setCharStatus('blocked');
            window.dispatchEvent(new CustomEvent('nanako:blocked', { detail: { reason: 'no_path' } }));
            setTimeout(() => setCharStatus('idle'), 1500); return;
        }
        const steps = path.slice(1); if (!steps.length) return;
        setCharLabel(label); setCharStatus('moving'); setCharPath(steps);
        window.dispatchEvent(new CustomEvent('nanako:moving', { detail: { target: [ec, er], label, path_length: steps.length } }));
    }, [pois]);

    useEffect(() => {
        const h = e => handleMoveTo(e.detail);
        window.addEventListener('nanako:move_to', h);
        return () => window.removeEventListener('nanako:move_to', h);
    }, [handleMoveTo]);

    // ── query_pos: 外部可查询当前坐标 ────────────────────────────────────────
    useEffect(() => {
        const respond = () => {
            const { col, row } = charPosRef.current;
            const currentPois = loadPois();
            // Find nearest named location (by Manhattan distance)
            let nearest = null, minDist = Infinity;
            currentPois.forEach(p => {
                const d = Math.abs(p.col - col) + Math.abs(p.row - row);
                if (d < minDist) { minDist = d; nearest = p; }
            });
            const detail = {
                col, row,
                location: nearest?.name || null,
                location_label: nearest?.label || null,
                distance_to_location: minDist,
            };
            window.dispatchEvent(new CustomEvent('nanako:position', { detail }));
        };
        window.addEventListener('nanako:query_pos', respond);
        // Also expose as a simple global function for console testing
        window.nanakoGetPos = () => { respond(); return charPosRef.current; };
        return () => {
            window.removeEventListener('nanako:query_pos', respond);
            delete window.nanakoGetPos;
        };
    }, []);

    const draw = useCallback(() => {
        const cv = canvasRef.current; if (!cv) return;
        drawScene(cv.getContext('2d'), cv.width, cv.height, zoom, offset, pois,
            charPosRef.current.col, charPosRef.current.row, charStatus, charLabel, hovered, charDirRef.current);
    }, [zoom, offset, pois, charStatus, charLabel, hovered]);

    useEffect(() => {
        const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
        animRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef.current);
    }, [draw]);

    useEffect(() => {
        const cv = canvasRef.current; if (!cv) return;
        const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
        resize(); const ro = new ResizeObserver(resize); ro.observe(cv);
        return () => ro.disconnect();
    }, []);

    const getRC = e => {
        const cv = canvasRef.current; if (!cv) return null;
        const r = cv.getBoundingClientRect(), cs = CELL * zoom;
        const col = Math.floor((e.clientX - r.left - offset.x) / cs);
        const row = Math.floor((e.clientY - r.top - offset.y) / cs);
        return (col >= 0 && col < COLS && row >= 0 && row < ROWS) ? { col, row } : null;
    };
    const onMouseMove = e => {
        setHovered(getRC(e));
        if (isDragging.current) {
            setOffset(o => ({ x: o.x + e.clientX - lastMouse.current.x, y: o.y + e.clientY - lastMouse.current.y }));
            lastMouse.current = { x: e.clientX, y: e.clientY };
        }
    };
    const onMouseDown = e => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; };
    const onMouseUp = () => isDragging.current = false;
    const onMouseLeave = () => { isDragging.current = false; setHovered(null); };
    const onWheel = e => { e.preventDefault(); setZoom(z => +(Math.max(0.3, Math.min(4, z + (e.deltaY < 0 ? .1 : -.1))).toFixed(2))); };
    const onClick = e => { if (!isDragging.current) { const rc = getRC(e); if (rc) handleMoveTo({ target: [rc.col, rc.row] }); } };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center font-sans pt-20 pb-6 px-4 select-none">
            <div className="w-full max-w-6xl mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-wide">🗺️ NANAKO WORLD MAP</h1>
                    <p className="text-slate-500 text-xs mt-0.5">{COLS}×{ROWS} · 精装修版 · 点击移动</p>
                </div>
                <div className="flex items-center gap-2">
                    {[['＋', .2], ['－', -.2]].map(([l, d]) => (
                        <button key={l} onClick={() => setZoom(z => +(Math.max(0.3, Math.min(4, z + d)).toFixed(2)))}
                            className="w-9 h-9 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl font-bold text-lg hover:bg-slate-700 transition-colors">{l}</button>
                    ))}
                    <span className="text-slate-400 font-mono text-sm w-14 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => { setZoom(0.65); setOffset({ x: 0, y: 0 }); }}
                        className="px-3 h-9 bg-slate-700 text-slate-300 border border-slate-600 rounded-xl text-xs font-bold hover:bg-slate-600 transition-colors">重置</button>
                </div>
            </div>
            <div className="w-full max-w-6xl mb-3 flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="font-mono text-sm text-emerald-400">
                    {charStatus === 'moving' ? `🚶 前往 ${charLabel || '...'}`
                        : charStatus === 'blocked' ? '❌ 无法到达目标'
                            : hovered ? `[${hovered.col},${hovered.row}] · 点击移动 · 拖拽平移 · 滚轮缩放`
                                : '点击地图移动菜菜子 · 拖拽平移 · 滚轮缩放'}
                </span>
                <span className="ml-auto text-xs font-mono text-slate-500">
                    菜菜子 [{charPos.col},{charPos.row}]{charPath.length > 0 && <span className="text-emerald-500 ml-1">→{charPath.length}格</span>}
                </span>
            </div>
            <div className="w-full max-w-6xl border border-slate-700 rounded-2xl overflow-hidden shadow-2xl shadow-black/60" style={{ height: 620 }}>
                <canvas ref={canvasRef} className="w-full h-full block"
                    style={{ cursor: isDragging.current ? 'grabbing' : 'pointer' }}
                    onWheel={onWheel} onMouseMove={onMouseMove} onMouseDown={onMouseDown}
                    onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onClick={onClick} />
            </div>
            <p className="text-slate-700 text-[10px] mt-3">Pure canvas renderer · 精装修版 · 48×28</p>
        </div>
    );
}
