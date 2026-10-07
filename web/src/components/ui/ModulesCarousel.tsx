import { useState, useEffect, useCallback } from 'react';

const slides = [
  {
    title: 'Activación de Alarmas',
    desc: 'Activa alarmas de pánico en tiempo real con notificación instantánea a la central de monitoreo y cuadrantes',
    svg: (
      <svg viewBox="0 0 340 280" fill="none" className="w-full h-full">
        <rect x="80" y="120" width="180" height="130" rx="8" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".6"/>
        <rect x="105" y="145" width="26" height="26" rx="3" fill="#0d2818" stroke="#22c55e" strokeWidth="1" opacity=".5"/>
        <rect x="157" y="145" width="26" height="26" rx="3" fill="#0d2818" stroke="#22c55e" strokeWidth="1" opacity=".5"/>
        <rect x="209" y="145" width="26" height="26" rx="3" fill="#0d2818" stroke="#22c55e" strokeWidth="1" opacity=".5"/>
        <rect x="105" y="190" width="26" height="26" rx="3" fill="#0d2818" stroke="#22c55e" strokeWidth="1" opacity=".5"/>
        <rect x="209" y="190" width="26" height="26" rx="3" fill="#0d2818" stroke="#22c55e" strokeWidth="1" opacity=".5"/>
        <rect x="155" y="202" width="32" height="48" rx="3" fill="#164e28" stroke="#22c55e" strokeWidth="1.5"/>
        <g transform="translate(170,60)">
          <path d="M0-24c-15 0-24 11-24 28h48c0-17-9-28-24-28z" fill="#22c55e" opacity=".9"/>
          <rect x="-28" y="4" width="56" height="7" rx="3.5" fill="#22c55e"/>
          <circle cx="0" cy="18" r="5.5" fill="#22c55e"/>
          <rect x="-3" y="-32" width="6" height="11" rx="3" fill="#22c55e"/>
        </g>
        <circle cx="170" cy="60" r="32" stroke="#22c55e" strokeWidth="2" fill="none" opacity=".6">
          <animate attributeName="r" values="32;68" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".6;0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="170" cy="60" r="32" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity=".4">
          <animate attributeName="r" values="32;80" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".4;0" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="170" cy="60" r="32" stroke="#22c55e" strokeWidth="1" fill="none" opacity=".3">
          <animate attributeName="r" values="32;95" dur="1.5s" begin="1s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".3;0" dur="1.5s" begin="1s" repeatCount="indefinite"/>
        </circle>
        <circle cx="275" cy="40" r="6" fill="#ef4444">
          <animate attributeName="opacity" values="1;.3;1" dur=".8s" repeatCount="indefinite"/>
        </circle>
        <text x="275" y="60" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="600" fontFamily="system-ui">ALERTA</text>
        <g transform="translate(20,35)">
          <rect width="65" height="28" rx="6" fill="#22c55e" opacity=".12" stroke="#22c55e" strokeWidth=".8"/>
          <circle cx="15" cy="14" r="5" fill="#22c55e" opacity=".6"/>
          <rect x="26" y="9" width="30" height="3" rx="1.5" fill="#22c55e" opacity=".4"/>
          <rect x="26" y="15" width="20" height="3" rx="1.5" fill="#22c55e" opacity=".3"/>
        </g>
      </svg>
    ),
  },
  {
    title: 'Control de Accesos',
    desc: 'Apertura remota de puertas y portones desde el panel, con registro automático de cada evento',
    svg: (
      <svg viewBox="0 0 340 280" fill="none" className="w-full h-full">
        <rect x="30" y="50" width="22" height="190" rx="4" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".7"/>
        <rect x="288" y="50" width="22" height="190" rx="4" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".7"/>
        <rect x="30" y="42" width="280" height="16" rx="4" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".6"/>
        <g>
          <rect x="52" y="58" width="115" height="174" fill="#164e28" stroke="#22c55e" strokeWidth="1" opacity=".5">
            <animate attributeName="width" values="115;12;12;115" dur="4s" repeatCount="indefinite"/>
          </rect>
          <line x1="75" y1="58" x2="75" y2="232" stroke="#22c55e" strokeWidth=".8" opacity=".4">
            <animate attributeName="x1" values="75;54;54;75" dur="4s" repeatCount="indefinite"/>
            <animate attributeName="x2" values="75;54;54;75" dur="4s" repeatCount="indefinite"/>
          </line>
          <line x1="105" y1="58" x2="105" y2="232" stroke="#22c55e" strokeWidth=".8" opacity=".4">
            <animate attributeName="x1" values="105;56;56;105" dur="4s" repeatCount="indefinite"/>
            <animate attributeName="x2" values="105;56;56;105" dur="4s" repeatCount="indefinite"/>
          </line>
        </g>
        <g>
          <rect x="173" y="58" width="115" height="174" fill="#164e28" stroke="#22c55e" strokeWidth="1" opacity=".5">
            <animate attributeName="x" values="173;296;296;173" dur="4s" repeatCount="indefinite"/>
            <animate attributeName="width" values="115;12;12;115" dur="4s" repeatCount="indefinite"/>
          </rect>
          <line x1="210" y1="58" x2="210" y2="232" stroke="#22c55e" strokeWidth=".8" opacity=".4">
            <animate attributeName="x1" values="210;298;298;210" dur="4s" repeatCount="indefinite"/>
            <animate attributeName="x2" values="210;298;298;210" dur="4s" repeatCount="indefinite"/>
          </line>
          <line x1="270" y1="58" x2="270" y2="232" stroke="#22c55e" strokeWidth=".8" opacity=".4">
            <animate attributeName="x1" values="270;302;302;270" dur="4s" repeatCount="indefinite"/>
            <animate attributeName="x2" values="270;302;302;270" dur="4s" repeatCount="indefinite"/>
          </line>
        </g>
        <g transform="translate(170,145)">
          <rect x="-16" y="-3" width="32" height="24" rx="4" fill="#22c55e" opacity=".8">
            <animate attributeName="opacity" values=".8;.2;.2;.8" dur="4s" repeatCount="indefinite"/>
          </rect>
          <path d="M-8-3v-11a8 8 0 0116 0v11" stroke="#22c55e" strokeWidth="2.5" fill="none" opacity=".6">
            <animate attributeName="opacity" values=".6;.15;.15;.6" dur="4s" repeatCount="indefinite"/>
          </path>
          <circle cx="0" cy="9" r="3" fill="#0a1628">
            <animate attributeName="fill" values="#0a1628;#22c55e;#22c55e;#0a1628" dur="4s" repeatCount="indefinite"/>
          </circle>
        </g>
        <g transform="translate(170,20)">
          <rect x="-38" y="-10" width="76" height="20" rx="10" fill="#22c55e" opacity=".12" stroke="#22c55e" strokeWidth=".8"/>
          <text x="0" y="4" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="600" fontFamily="system-ui">ABRIENDO</text>
        </g>
      </svg>
    ),
  },
  {
    title: 'Snapshots de Cámaras',
    desc: 'Captura instantánea desde cámaras IP con evidencia fotográfica automática ante cada evento',
    svg: (
      <svg viewBox="0 0 340 280" fill="none" className="w-full h-full">
        <g transform="translate(170,95)">
          <rect x="-8" y="-72" width="16" height="28" rx="4" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1"/>
          <rect x="-54" y="-44" width="108" height="68" rx="10" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5"/>
          <circle cx="0" cy="-10" r="24" fill="#0d2818" stroke="#22c55e" strokeWidth="1.5"/>
          <circle cx="0" cy="-10" r="16" fill="#0a1628" stroke="#22c55e" strokeWidth="1"/>
          <circle cx="0" cy="-10" r="8" fill="#164e28" stroke="#22c55e" strokeWidth=".8">
            <animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="-38" cy="-28" r="4" fill="#ef4444" opacity=".6">
            <animate attributeName="opacity" values=".6;.2;.6" dur="1.2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="38" cy="-28" r="4" fill="#22c55e" opacity=".8">
            <animate attributeName="opacity" values=".8;.3;.8" dur="1s" repeatCount="indefinite"/>
          </circle>
        </g>
        <rect x="55" y="50" width="230" height="3" rx="1.5" fill="#22c55e" opacity=".3">
          <animate attributeName="y" values="50;195;50" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".5;.1;.5" dur="3s" repeatCount="indefinite"/>
        </rect>
        <g stroke="#22c55e" strokeWidth="2.5" opacity=".7">
          <path d="M60 60h28M60 60v20"/>
          <path d="M280 60h-28M280 60v20"/>
          <path d="M60 210h28M60 210v-20"/>
          <path d="M280 210h-28M280 210v-20"/>
        </g>
        <rect x="55" y="50" width="230" height="168" rx="6" fill="#fff" opacity="0">
          <animate attributeName="opacity" values="0;0;0;0;0;.5;0;0;0;0" dur="4s" repeatCount="indefinite"/>
        </rect>
        <g transform="translate(255,68)">
          <circle r="5" fill="#ef4444">
            <animate attributeName="opacity" values="1;.3;1" dur="1s" repeatCount="indefinite"/>
          </circle>
          <text x="12" y="5" fill="#ef4444" fontSize="10" fontWeight="700" fontFamily="system-ui">REC</text>
        </g>
        <g transform="translate(170,240)">
          <rect x="-42" y="-10" width="84" height="20" rx="10" fill="#22c55e" opacity=".12" stroke="#22c55e" strokeWidth=".8"/>
          <text x="0" y="4" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="600" fontFamily="system-ui">SNAPSHOT</text>
        </g>
      </svg>
    ),
  },
  {
    title: 'Monitoreo de Rondas',
    desc: 'Seguimiento GPS de rondas de vigilancia con checkpoints, tiempos y verificación automática del recorrido',
    svg: (
      <svg viewBox="0 0 340 280" fill="none" className="w-full h-full">
        <rect x="15" y="10" width="310" height="220" rx="10" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1" opacity=".5"/>
        <g stroke="#22c55e" strokeWidth=".5" opacity=".2">
          <line x1="80" y1="10" x2="80" y2="230"/><line x1="145" y1="10" x2="145" y2="230"/>
          <line x1="210" y1="10" x2="210" y2="230"/><line x1="275" y1="10" x2="275" y2="230"/>
          <line x1="15" y1="65" x2="325" y2="65"/><line x1="15" y1="120" x2="325" y2="120"/>
          <line x1="15" y1="175" x2="325" y2="175"/>
        </g>
        <rect x="85" y="70" width="55" height="45" rx="4" fill="#164e28" opacity=".3" stroke="#22c55e" strokeWidth=".5"/>
        <rect x="150" y="70" width="55" height="45" rx="4" fill="#164e28" opacity=".3" stroke="#22c55e" strokeWidth=".5"/>
        <rect x="215" y="70" width="55" height="45" rx="4" fill="#164e28" opacity=".3" stroke="#22c55e" strokeWidth=".5"/>
        <rect x="85" y="125" width="55" height="45" rx="4" fill="#164e28" opacity=".3" stroke="#22c55e" strokeWidth=".5"/>
        <rect x="150" y="125" width="55" height="45" rx="4" fill="#164e28" opacity=".3" stroke="#22c55e" strokeWidth=".5"/>
        <path d="M40 60 L80 60 L80 118 L145 118 L145 60 L210 60 L210 173 L145 173 L145 118" stroke="#22c55e" strokeWidth="2" strokeDasharray="8 4" fill="none" opacity=".4"/>
        <circle r="8" fill="#22c55e" opacity=".9">
          <animateMotion dur="6s" repeatCount="indefinite" path="M40,60 L80,60 L80,118 L145,118 L145,60 L210,60 L210,173 L145,173 L145,118"/>
          <animate attributeName="opacity" values=".9;.5;.9" dur="1s" repeatCount="indefinite"/>
        </circle>
        <circle r="8" fill="none" stroke="#22c55e" strokeWidth="1">
          <animateMotion dur="6s" repeatCount="indefinite" path="M40,60 L80,60 L80,118 L145,118 L145,60 L210,60 L210,173 L145,173 L145,118"/>
          <animate attributeName="r" values="8;30" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".5;0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <g transform="translate(80,60)"><circle r="5" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity=".6"/><circle r="2" fill="#22c55e" opacity=".6"/></g>
        <g transform="translate(145,60)"><circle r="5" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity=".6"/><circle r="2" fill="#22c55e" opacity=".6"/></g>
        <g transform="translate(210,60)"><circle r="5" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity=".6"/><circle r="2" fill="#22c55e" opacity=".6"/></g>
        <g transform="translate(15,248)">
          <rect width="120" height="18" rx="4" fill="#22c55e" opacity=".1"/>
          <text x="10" y="13" fill="#22c55e" fontSize="9" fontWeight="500" fontFamily="system-ui">Ronda 3/5 - 68%</text>
        </g>
        <g transform="translate(205,248)">
          <rect width="120" height="18" rx="4" fill="#22c55e" opacity=".1"/>
          <circle cx="14" cy="9" r="4" fill="#22c55e" opacity=".7">
            <animate attributeName="opacity" values=".7;.3;.7" dur="1s" repeatCount="indefinite"/>
          </circle>
          <text x="24" y="13" fill="#22c55e" fontSize="9" fontWeight="500" fontFamily="system-ui">EN RONDA</text>
        </g>
      </svg>
    ),
  },
  {
    title: 'Reportes PTT',
    desc: 'Envía reportes de voz Push-to-Talk con transcripción y registro automático de cada comunicación',
    svg: (
      <svg viewBox="0 0 340 280" fill="none" className="w-full h-full">
        <g transform="translate(120,30)">
          <rect x="-4" y="-20" width="8" height="30" rx="4" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".7"/>
          <circle cx="0" cy="-24" r="4" fill="#22c55e" opacity=".5">
            <animate attributeName="opacity" values=".5;1;.5" dur="1.2s" repeatCount="indefinite"/>
          </circle>
          <rect x="-30" y="10" width="60" height="110" rx="10" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".8"/>
          <g opacity=".4">
            <line x1="-18" y1="25" x2="18" y2="25" stroke="#22c55e" strokeWidth="1"/>
            <line x1="-18" y1="31" x2="18" y2="31" stroke="#22c55e" strokeWidth="1"/>
            <line x1="-18" y1="37" x2="18" y2="37" stroke="#22c55e" strokeWidth="1"/>
            <line x1="-18" y1="43" x2="18" y2="43" stroke="#22c55e" strokeWidth="1"/>
          </g>
          <rect x="-34" y="40" width="8" height="30" rx="3" fill="#22c55e" opacity=".6">
            <animate attributeName="opacity" values=".6;1;.6" dur="2s" repeatCount="indefinite"/>
          </rect>
          <rect x="-18" y="60" width="36" height="20" rx="3" fill="#0d2818" stroke="#22c55e" strokeWidth=".8"/>
          <rect x="-14" y="64" width="28" height="3" rx="1.5" fill="#22c55e" opacity=".4"/>
          <rect x="-14" y="70" width="18" height="3" rx="1.5" fill="#22c55e" opacity=".3"/>
        </g>
        <g transform="translate(155,60)" opacity=".5">
          <path d="M5 -10 Q15 0 5 10" stroke="#22c55e" strokeWidth="1.5" fill="none">
            <animate attributeName="opacity" values=".5;0;.5" dur="1.5s" repeatCount="indefinite"/>
          </path>
          <path d="M12 -18 Q28 0 12 18" stroke="#22c55e" strokeWidth="1.5" fill="none">
            <animate attributeName="opacity" values=".4;0;.4" dur="1.5s" begin=".3s" repeatCount="indefinite"/>
          </path>
          <path d="M19 -26 Q42 0 19 26" stroke="#22c55e" strokeWidth="1.5" fill="none">
            <animate attributeName="opacity" values=".3;0;.3" dur="1.5s" begin=".6s" repeatCount="indefinite"/>
          </path>
        </g>
        <g transform="translate(220,40)">
          <rect x="0" y="0" width="90" height="120" rx="6" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".7"/>
          <rect x="10" y="10" width="70" height="14" rx="3" fill="#22c55e" opacity=".12"/>
          <text x="45" y="21" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="600" fontFamily="system-ui">REPORTE PTT</text>
          <g transform="translate(10,35)" opacity=".5">
            <rect x="0" y="4" width="3" height="8" rx="1" fill="#22c55e"/>
            <rect x="5" y="2" width="3" height="12" rx="1" fill="#22c55e"/>
            <rect x="10" y="6" width="3" height="4" rx="1" fill="#22c55e"/>
            <rect x="15" y="0" width="3" height="16" rx="1" fill="#22c55e"/>
            <rect x="20" y="3" width="3" height="10" rx="1" fill="#22c55e"/>
            <rect x="25" y="5" width="3" height="6" rx="1" fill="#22c55e"/>
            <rect x="30" y="1" width="3" height="14" rx="1" fill="#22c55e"/>
            <rect x="35" y="4" width="3" height="8" rx="1" fill="#22c55e"/>
          </g>
          <rect x="10" y="58" width="55" height="3" rx="1.5" fill="#22c55e" opacity=".3"/>
          <rect x="10" y="66" width="65" height="3" rx="1.5" fill="#22c55e" opacity=".25"/>
          <rect x="10" y="74" width="45" height="3" rx="1.5" fill="#22c55e" opacity=".2"/>
          <rect x="10" y="90" width="70" height="14" rx="3" fill="#22c55e" opacity=".08"/>
          <text x="45" y="100" textAnchor="middle" fill="#22c55e" fontSize="7" fontFamily="system-ui" opacity=".5">14:32 - 2min 15s</text>
        </g>
        <path d="M155 85 Q185 85 210 70" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="5 3" fill="none" opacity=".4">
          <animate attributeName="strokeDashoffset" values="0;-16" dur="1s" repeatCount="indefinite"/>
        </path>
        <g transform="translate(40,220)">
          <rect width="100" height="20" rx="10" fill="#22c55e" opacity=".1" stroke="#22c55e" strokeWidth=".8"/>
          <circle cx="14" cy="10" r="3" fill="#22c55e" opacity=".7">
            <animate attributeName="opacity" values=".7;.3;.7" dur="1s" repeatCount="indefinite"/>
          </circle>
          <text x="24" y="14" fill="#22c55e" fontSize="9" fontWeight="500" fontFamily="system-ui">GRABANDO</text>
        </g>
        <g transform="translate(200,220)">
          <rect width="105" height="20" rx="10" fill="#22c55e" opacity=".1" stroke="#22c55e" strokeWidth=".8"/>
          <text x="12" y="14" fill="#22c55e" fontSize="9" fontWeight="500" fontFamily="system-ui">12 reportes hoy</text>
        </g>
      </svg>
    ),
  },
  {
    title: 'PTT con Asistente IA',
    desc: 'Inteligencia artificial analiza comunicaciones de voz PTT, genera resúmenes y sugiere acciones en tiempo real',
    svg: (
      <svg viewBox="0 0 340 280" fill="none" className="w-full h-full">
        <g transform="translate(170,100)">
          <circle cx="0" cy="0" r="50" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".6"/>
          <circle cx="0" cy="0" r="38" fill="#0d2818" stroke="#22c55e" strokeWidth="1" opacity=".5"/>
          <g stroke="#22c55e" strokeWidth=".8" opacity=".4">
            <line x1="-20" y1="-15" x2="5" y2="-25"/><line x1="5" y1="-25" x2="20" y2="-10"/>
            <line x1="20" y1="-10" x2="15" y2="15"/><line x1="15" y1="15" x2="-10" y2="20"/>
            <line x1="-10" y1="20" x2="-25" y2="5"/><line x1="-25" y1="5" x2="-20" y2="-15"/>
            <line x1="-20" y1="-15" x2="15" y2="15"/><line x1="5" y1="-25" x2="-10" y2="20"/>
          </g>
          {[[-20,-15,.3],[5,-25,.6],[20,-10,.9],[15,15,1.2],[-10,20,1.5],[-25,5,1.8]].map(([cx,cy,delay],i) => (
            <circle key={i} cx={cx} cy={cy} r="4" fill="#22c55e" opacity=".7">
              <animate attributeName="opacity" values=".7;.3;.7" dur="1.5s" begin={`${delay}s`} repeatCount="indefinite"/>
            </circle>
          ))}
          <text x="0" y="5" textAnchor="middle" fill="#22c55e" fontSize="16" fontWeight="700" fontFamily="system-ui" opacity=".8">IA</text>
        </g>
        <circle cx="170" cy="100" r="50" stroke="#22c55e" strokeWidth="1" fill="none" opacity=".3">
          <animate attributeName="r" values="50;75" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".3;0" dur="2s" repeatCount="indefinite"/>
        </circle>
        <g transform="translate(40,80)">
          <rect x="-12" y="-30" width="24" height="50" rx="12" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".7"/>
          <rect x="-8" y="-25" width="16" height="20" rx="8" fill="#164e28" stroke="#22c55e" strokeWidth="1" opacity=".5"/>
          <line x1="-5" y1="-20" x2="5" y2="-20" stroke="#22c55e" strokeWidth=".8" opacity=".3"/>
          <line x1="-5" y1="-16" x2="5" y2="-16" stroke="#22c55e" strokeWidth=".8" opacity=".3"/>
          <path d="M16 -10 Q24 0 16 10" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity=".5">
            <animate attributeName="opacity" values=".5;0;.5" dur="1s" repeatCount="indefinite"/>
          </path>
          <path d="M22 -18 Q36 0 22 18" stroke="#22c55e" strokeWidth="1" fill="none" opacity=".3">
            <animate attributeName="opacity" values=".3;0;.3" dur="1s" begin=".3s" repeatCount="indefinite"/>
          </path>
        </g>
        <path d="M75 80 Q100 80 120 90" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="5 3" fill="none" opacity=".4">
          <animate attributeName="strokeDashoffset" values="0;-16" dur="1s" repeatCount="indefinite"/>
        </path>
        <g transform="translate(260,55)">
          <rect x="-40" y="0" width="80" height="90" rx="8" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".7"/>
          {[0,8,16,24].map((y,i) => (
            <rect key={i} x="-30" y={12+y} width={50-i*10} height="3" rx="1.5" fill="#22c55e" opacity={.5-i*.1}>
              <animate attributeName="width" values={`0;${50-i*10}`} dur="2s" begin={`${i*.4}s`} repeatCount="indefinite"/>
            </rect>
          ))}
          <path d="M-40 45 L-52 55 L-40 55" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".7"/>
        </g>
        <g transform="translate(60,220)">
          <rect width="105" height="20" rx="10" fill="#22c55e" opacity=".1" stroke="#22c55e" strokeWidth=".8"/>
          <text x="12" y="14" fill="#22c55e" fontSize="9" fontWeight="500" fontFamily="system-ui">Procesando voz...</text>
        </g>
        <g transform="translate(190,220)">
          <rect width="95" height="20" rx="10" fill="#22c55e" opacity=".1" stroke="#22c55e" strokeWidth=".8"/>
          <circle cx="14" cy="10" r="3" fill="#22c55e" opacity=".7">
            <animate attributeName="opacity" values=".7;.3;.7" dur="1s" repeatCount="indefinite"/>
          </circle>
          <text x="24" y="14" fill="#22c55e" fontSize="9" fontWeight="500" fontFamily="system-ui">IA ACTIVA</text>
        </g>
        <g transform="translate(170,10)">
          <rect x="-48" y="-10" width="96" height="20" rx="10" fill="#22c55e" opacity=".12" stroke="#22c55e" strokeWidth=".8"/>
          <text x="0" y="4" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="600" fontFamily="system-ui">ASISTENTE IA</text>
        </g>
      </svg>
    ),
  },
  {
    title: 'Botón de Pánico Personal',
    desc: 'Control físico con GPS: al presionar el botón SOS, la ubicación exacta llega al instante a la central Whatseg',
    svg: (
      <svg viewBox="0 0 340 280" fill="none" className="w-full h-full">
        <g transform="translate(100,100)">
          <circle cx="0" cy="-30" r="14" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".7"/>
          <path d="M-18 0c0-12 8-20 18-20s18 8 18 20v40h-36z" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".6"/>
          <path d="M18 10 L50 -10" stroke="#22c55e" strokeWidth="2" opacity=".6" strokeLinecap="round"/>
        </g>
        <g transform="translate(160,70)">
          <rect x="-20" y="-35" width="40" height="70" rx="10" fill="#0f2d1a" stroke="#22c55e" strokeWidth="2" opacity=".8"/>
          <circle cx="0" cy="-5" r="14" fill="#ef4444" opacity=".8">
            <animate attributeName="r" values="14;16;14" dur="1.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values=".8;1;.8" dur="1.2s" repeatCount="indefinite"/>
          </circle>
          <text x="0" y="0" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="system-ui">SOS</text>
          <circle cx="0" cy="-24" r="3" fill="#22c55e" opacity=".7">
            <animate attributeName="opacity" values=".7;.2;.7" dur=".6s" repeatCount="indefinite"/>
          </circle>
        </g>
        <circle cx="160" cy="35" r="30" stroke="#ef4444" strokeWidth="1.5" fill="none" opacity=".5">
          <animate attributeName="r" values="30;60" dur="1.8s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".5;0" dur="1.8s" repeatCount="indefinite"/>
        </circle>
        <circle cx="160" cy="35" r="30" stroke="#ef4444" strokeWidth="1" fill="none" opacity=".3">
          <animate attributeName="r" values="30;80" dur="1.8s" begin=".6s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".3;0" dur="1.8s" begin=".6s" repeatCount="indefinite"/>
        </circle>
        <path d="M210 50 Q240 30 260 50 Q280 70 300 55" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="5 3" fill="none" opacity=".5">
          <animate attributeName="strokeDashoffset" values="0;-16" dur="1s" repeatCount="indefinite"/>
        </path>
        <g transform="translate(260,80)">
          <rect x="-30" y="-30" width="60" height="80" rx="6" fill="#0f2d1a" stroke="#22c55e" strokeWidth="1.5" opacity=".7"/>
          <rect x="-24" y="-24" width="48" height="55" rx="3" fill="#0d2818" stroke="#22c55e" strokeWidth=".8"/>
          <rect x="-18" y="-18" width="36" height="12" rx="2" fill="#ef4444" opacity=".3">
            <animate attributeName="opacity" values=".3;.6;.3" dur="1s" repeatCount="indefinite"/>
          </rect>
          <text x="0" y="-9" textAnchor="middle" fill="#ef4444" fontSize="6" fontWeight="700" fontFamily="system-ui">ALERTA SOS</text>
        </g>
        <g transform="translate(100,40)">
          <path d="M0 12L-8-2a10 10 0 1116 0z" fill="#22c55e" opacity=".5"/>
          <circle cx="0" cy="-6" r="4" fill="#0a1628"/>
          <text x="0" y="-3" textAnchor="middle" fill="#22c55e" fontSize="5" fontWeight="700" fontFamily="system-ui">GPS</text>
        </g>
        <g transform="translate(130,230)">
          <rect x="-55" y="-10" width="110" height="20" rx="10" fill="#ef4444" opacity=".12" stroke="#ef4444" strokeWidth=".8"/>
          <circle cx="-38" cy="0" r="3" fill="#ef4444">
            <animate attributeName="opacity" values="1;.3;1" dur=".7s" repeatCount="indefinite"/>
          </circle>
          <text x="5" y="4" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="600" fontFamily="system-ui">EMERGENCIA</text>
        </g>
      </svg>
    ),
  },
];

export default function ModulesCarousel() {
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState<number | null>(null);

  const goTo = useCallback((next: number) => {
    setExiting(current);
    setTimeout(() => {
      setExiting(null);
      setCurrent(next);
    }, 100);
  }, [current]);

  useEffect(() => {
    const id = setInterval(() => goTo((current + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [current, goTo]);

  const getStyle = (i: number): React.CSSProperties => {
    if (i === current) return { opacity: 1, transform: 'translateX(0)', transition: 'all .6s cubic-bezier(.4,0,.2,1)' };
    if (i === exiting) return { opacity: 0, transform: 'translateX(-60px)', transition: 'all .6s cubic-bezier(.4,0,.2,1)', pointerEvents: 'none' };
    return { opacity: 0, transform: 'translateX(60px)', pointerEvents: 'none' };
  };

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Slides */}
      <div className="relative w-full overflow-hidden" style={{ height: 400 }}>
        {slides.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 flex flex-col items-center justify-center px-2"
            style={getStyle(i)}
          >
            {/* SVG illustration */}
            <div className="w-full h-52 flex items-center justify-center mb-4">
              {s.svg}
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-2 leading-tight">
              {s.title}
            </h3>
            <p className="text-xs text-slate-400 text-center leading-relaxed px-2" style={{ maxWidth: '100%' }}>
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="flex gap-2 mt-3">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="h-2 rounded-full transition-all duration-300 border-0"
            style={{
              width: i === current ? 24 : 8,
              background: i === current ? '#22c55e' : 'rgba(255,255,255,.15)',
              boxShadow: i === current ? '0 0 12px rgba(34,197,94,.4)' : 'none',
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
