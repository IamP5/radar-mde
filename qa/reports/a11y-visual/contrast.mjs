const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const cr=(a,b)=>{const [x,y]=[L(a),L(b)].sort((p,q)=>q-p);return ((x+0.05)/(y+0.05)).toFixed(2)};
const light={card:'#ffffff',bin1:'#b42727',bin2:'#ec9a98',bin3:'#dcdad3',bin4:'#86b6ef',bin5:'#2a78d6',nd:'#f2f2f2',red1:'#f7d9d8',red2:'#efaeac',red3:'#e27371',red4:'#c53a39',red5:'#8a1f1f',s1:'#2a78d6',s2:'#eb6834',s3:'#1baf7a',s4:'#eda100',s5:'#e87ba4',good:'#19a64b',warning:'#f5a623',critical:'#da2f35',subtle:'#8f8f8f',muted:'#666666',axis:'#d4d4d4',grid:'#f0f0f0'};
const dark={card:'#0a0a0a',bin1:'#e66767',bin2:'#8f3a39',bin3:'#46453f',bin4:'#1c5cab',bin5:'#6da7ec',nd:'#1a1a1a',red1:'#5c3230',red2:'#833a38',red3:'#ad4543',red4:'#d75b59',red5:'#f59d9b',s1:'#3987e5',s2:'#d95926',s3:'#199e70',s4:'#c98500',s5:'#d55181',good:'#2bb95b',warning:'#f5a623',critical:'#ff6166',subtle:'#8f8f8f',muted:'#a1a1a1',axis:'#333333',grid:'#1c1c1c'};
for(const [n,t] of [['light',light],['dark',dark]]){ console.log('==',n,'vs card',t.card); for(const [k,v] of Object.entries(t)) if(k!=='card') console.log(k.padEnd(9),v,cr(v,t.card));
 console.log('adjacent bins', ['bin1','bin2','bin3','bin4','bin5'].map((k,i,a)=>i?`${a[i-1]}/${k}=${cr(t[a[i-1]],t[k])}`:'').join(' '));
 console.log('adjacent reds', ['bin3','red1','red2','red3','red4','red5'].map((k,i,a)=>i?`${a[i-1]}/${k}=${cr(t[a[i-1]],t[k])}`:'').join(' '));}
console.log('critical text on critical-soft light', cr('#da2f35','#fff0f0'), 'on white', cr('#da2f35','#ffffff'),'on canvas',cr('#da2f35','#fafafa'));
console.log('dark critical on critical-soft', cr('#ff6166','#2a1011'));
console.log('warning-ink on warning-soft', cr('#9a5800','#fff6e5'), 'good-ink on good-soft', cr('#107d32','#ebfaef'));
console.log('muted on canvas', cr('#666666','#fafafa'), 'muted on muted bg', cr('#666666','#f2f2f2'), 'dark muted on #1a1a1a', cr('#a1a1a1','#1a1a1a'));
console.log('brand-ink link on white', cr('#005ccf','#ffffff'), 'dark', cr('#52a8ff','#0a0a0a'));
console.log('focus ring brand on white', cr('#0070f3','#ffffff'), 'on canvas', cr('#0070f3','#fafafa'), 'dark brand ring', cr('#0070f3','#0a0a0a'));
