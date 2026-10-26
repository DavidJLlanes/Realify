/* 138 marcos vectoriales/procedurales, sin dependencias externas.
   Cada preset tiene grosor y paleta propios; render.js aporta una geometría
   distinta para cada variante. */

export const FRAME_CATEGORIES=[
  ["basic","Básicos"],["minimal","Minimalistas"],["classic","Clásicos"],["mat","Paspartú"],
  ["film","Película"],["instant","Instantánea"],["vintage","Vintage"],
  ["geometric","Geométricos"],["decorative","Decorativos"],
  ["color","Color"],["festive","Festivos"],["artistic","De autor"]
];

const defs=[
  ["minimal","Minimal",["line","double","triple","inset","hairline","soft","bold","offset","corner","shadow","white","black"]],
  ["classic","Clásico",["ebony","walnut","oak","mahogany","gold","silver","bronze","ivory","gallery","bevel","museum","dark"]],
  ["mat","Paspartú",["white","warm","cream","gray","black","navy","sage","rose","sand","double","museum","wide"]],
  ["film","Película",["35mm","cinema","contact","negative","slide","super8","bw","warm","cool","grain","sprocket","classic"]],
  ["instant","Instantánea",["white","cream","black","retro","warm","cool","caption","square","wide","thin","shadow","aged"]],
  ["vintage","Vintage",["sepia","aged","paper","deckle","burnt","postal","victorian","artdeco","faded","ink","linen","album"]],
  ["geometric","Geométrico",["grid","corner","diagonal","hex","chevron","blocks","dots","stripes","maze","steps","diamond","rings"]],
  ["decorative","Decorativo",["floral","leaf","lace","scroll","ornament","baroque","ribbon","stars","hearts","waves","pearls","corners"]],
  ["color","Color",["rainbow","sunset","ocean","forest","candy","neon","duotone","pastel","gradient","pop","electric","mono"]],
  ["festive","Festivo",["birthday","confetti","winter","snow","holiday","newyear","love","spring","summer","autumn","party","celebration"]]
];

const widths={
  minimal:[2,3,4,3,1.5,5,7,4,3,5,5,5],
  classic:[6,7,7,7,8,7,8,6,7,8,9,6],
  mat:[9,10,10,9,9,10,10,10,11,11,12,15],
  film:[7,8,6,7,9,7,8,8,7,9,7,8],
  instant:[8,9,8,9,10,9,11,8,12,6,9,10],
  vintage:[8,9,8,9,10,8,9,8,9,8,9,11],
  geometric:[6,5,7,6,6,7,5,6,7,6,6,7],
  decorative:[7,7,8,7,8,9,7,6,7,7,6,7],
  color:[6,7,7,7,7,8,7,7,8,7,8,6],
  festive:[7,8,8,8,9,8,7,8,8,8,8,9]
};

const palettes={
  minimal:[
    ["#ffffff","#111111"],["#f5f5f5","#333333"],["#ffffff","#8a8a8a"],["#dadada","#242424"],
    ["#ffffff","#999999"],["#bfc5cc","#ffffff"],["#111111","#555555"],["#eeeeee","#1d1d1d"],
    ["#ffffff","#cfcfcf"],["#e9e9e9","#101010"],["#ffffff","#bdbdbd"],["#111111","#666666"]
  ],
  classic:[
    ["#18130f","#6d4a32"],["#6f4429","#c28c5a"],["#b7834b","#6c431f"],["#522b22","#a76c55"],
    ["#b38a30","#f7df8d"],["#a9adb3","#f4f7fb"],["#8c6a3a","#dfb16a"],["#eee7d6","#9e8f75"],
    ["#252525","#e8e8e8"],["#8f6c4d","#2e1a10"],["#4f2f20","#c7ae89"],["#111111","#555555"]
  ],
  mat:[
    ["#ffffff","#777777"],["#f5efe4","#967f68"],["#e8ddc8","#988568"],["#a9adb3","#666a70"],
    ["#111111","#777777"],["#1f304d","#8192aa"],["#87967b","#53634f"],["#cfa6aa","#8d676c"],
    ["#d8c5a5","#9e8967"],["#f7f2e9","#b69c78"],["#ece7dd","#8b765d"],["#fafafa","#999999"]
  ],
  film:[
    ["#111111","#f5f5f5"],["#090909","#e7e7e7"],["#151515","#d7d7d7"],["#0b0b0b","#777777"],
    ["#f1eee6","#555555"],["#111111","#d94a4a"],["#242424","#eeeeee"],["#725038","#f4d9ae"],
    ["#111111","#cde8ff"],["#0b0b0b","#ffffff"],["#121212","#888888"],["#0b0b0b","#eeeeee"]
  ],
  instant:[
    ["#faf8f1","#bbbbbb"],["#efe7d7","#b9aa92"],["#101010","#777777"],["#f0e4cf","#b49a75"],
    ["#f3dfbd","#fff8e8"],["#e6eff0","#bdd7dc"],["#ffffff","#666666"],["#fafafa","#bbbbbb"],
    ["#f8f4ea","#bbbbbb"],["#fffdf8","#aaaaaa"],["#f7f7f7","#777777"],["#e5d8c3","#6a4f34"]
  ],
  vintage:[
    ["#b98d5b","#3a2415"],["#c9a675","#ead3ab"],["#d8bf96","#8a6b49"],["#aa8a68","#f0ddbf"],
    ["#8d482f","#d09a63"],["#cdb58d","#65442e"],["#c5aa7b","#5a3d2c"],["#b9956d","#3c261a"],
    ["#c2ad8d","#e3d5bd"],["#8d745e","#34251d"],["#b9a17d","#d7c7aa"],["#9b805d","#e5d4b6"]
  ],
  geometric:[
    ["#202631","#8fb3ff"],["#15212d","#70d7ff"],["#252033","#e178ff"],["#172c2b","#77e0c5"],
    ["#2f2517","#ffd166"],["#262626","#f4f4f4"],["#172035","#ff7aa2"],["#1e293b","#7dd3fc"],
    ["#252033","#c4b5fd"],["#14251d","#86efac"],["#2a1f18","#fdba74"],["#202020","#d4d4d4"]
  ],
  decorative:[
    ["#775b73","#e4c5da"],["#48624c","#c7e2bd"],["#6c5b67","#f0dce7"],["#654d42","#e6cab8"],
    ["#5b4b73","#d9c9ff"],["#4e342e","#d7b899"],["#704d68","#f0c9df"],["#343b58","#f6d365"],
    ["#754a58","#ffb7c5"],["#315b63","#a8e6e8"],["#5c5367","#eee3ff"],["#5a4637","#dec2a1"]
  ],
  color:[
    ["#ff416c","#ff4b2b"],["#ff9966","#ff5e62"],["#2193b0","#6dd5ed"],["#134e5e","#71b280"],
    ["#ffafbd","#ffc3a0"],["#00f2fe","#4facfe"],["#8e2de2","#4a00e0"],["#fbc2eb","#a6c1ee"],
    ["#f953c6","#b91d73"],["#00c6ff","#0072ff"],["#12c2e9","#c471ed"],["#111111","#777777"]
  ],
  festive:[
    ["#ff7a59","#ffd166"],["#ff4e50","#f9d423"],["#8ec5fc","#e0c3fc"],["#d4fc79","#96e6a1"],
    ["#c31432","#f1d7a3"],["#f7971e","#ffd200"],["#ff758c","#ffffff"],["#a8edea","#fed6e3"],
    ["#4facfe","#00f2fe"],["#f6d365","#fda085"],["#ee9ca7","#ffdde1"],["#654ea3","#eaafc8"]
  ]
};

const legacyPresets=defs.flatMap(([category,prefix,names])=>
  names.map((name,i)=>({
    id:`${category}-${String(i+1).padStart(2,"0")}`,
    label:`${prefix} · ${name[0].toUpperCase()+name.slice(1)}`,
    category,family:category,variant:i,width:widths[category][i],
    singleColor:category==="minimal"&&[0,4,5,6,8,9].includes(i),
    primary:palettes[category][i][0],secondary:palettes[category][i][1]
  }))
);

const artisticDefs=[
  ["aurora","Aurora boreal",12,"#183248","#72e7c3"],
  ["prism","Prisma facetado",10,"#604aa2","#73dce7"],
  ["eclipse","Eclipse de metal",9,"#0b1018","#ddb967"],
  ["kintsugi","Porcelana kintsugi",11,"#efe8d9","#b98d39"],
  ["topography","Atlas topográfico",10,"#102d31","#97d4b6"],
  ["arcades","Arcadas art déco",12,"#222839","#e8bb82"],
  ["glass","Vitral de joyería",12,"#267879","#e6ab61"],
  ["origami","Pliegues de origami",12,"#b9b2d9","#5c478d"],
  ["constellation","Constelación",11,"#101c35","#bedcff"],
  ["moire","Seda moiré",10,"#111722","#91d3e2"],
  ["ripple","Ondas de nácar",10,"#447d83","#ead4df"],
  ["circuit","Circuito luminoso",10,"#112822","#62e9b4"],
  ["hologram","Lámina holográfica",10,"#bd8be6","#69dbe5"],
  ["marble","Mármol azul",11,"#f0eeea","#637c9b"],
  ["botanical","Herbario grabado",12,"#244534","#d0d8a8"],
  ["deco","Abanico art déco",12,"#152335","#d7b578"]
];

export const FRAME_PRESETS=[
  {id:"basic-solid",label:"Liso · Color único",category:"basic",family:"basic",singleColor:true,width:6,primary:"#ffffff",secondary:"#ffffff"},
  ...legacyPresets,
  {id:"geometric-heart",label:"Geométrico · Heart",category:"geometric",family:"geometric",motif:"heart",width:8,primary:"#241d32",secondary:"#efa0bc"},
  ...artisticDefs.map(([style,label,width,primary,secondary])=>({
    id:`artistic-${style}`,category:"artistic",family:"artistic",style,label,width,primary,secondary
  }))
];

export const frameById=id=>FRAME_PRESETS.find(f=>f.id===id)||FRAME_PRESETS[0];
export const framesInCategory=id=>FRAME_PRESETS.filter(f=>f.category===id);
