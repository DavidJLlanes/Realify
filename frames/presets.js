/* 120 marcos vectoriales/procedurales, sin dependencias externas.
   10 categorías × 12 variantes. Los SVG CC0 externos pueden añadirse
   después como otra familia sin cambiar la UI ni el formato de preset. */

export const FRAME_CATEGORIES = [
  ["minimal","Minimalistas"],["classic","Clásicos"],["mat","Paspartú"],
  ["film","Película"],["instant","Instantánea"],["vintage","Vintage"],
  ["geometric","Geométricos"],["decorative","Decorativos"],
  ["color","Color"],["festive","Festivos"]
];

const defs = [
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

const palette = {
  minimal:["#ffffff","#111111"], classic:["#7a4d2b","#d4af37"], mat:["#f4f0e8","#c8c1b5"],
  film:["#111111","#f5f5f5"], instant:["#f7f4eb","#d9d2c3"], vintage:["#8a6a46","#e4d2ad"],
  geometric:["#202631","#8fb3ff"], decorative:["#775b73","#e4c5da"],
  color:["#ff4d8d","#5ed7ff"], festive:["#ffb347","#ff5f6d"]
};

export const FRAME_PRESETS = defs.flatMap(([category,prefix,names]) =>
  names.map((name,i)=>({
    id:`${category}-${String(i+1).padStart(2,"0")}`,
    label:`${prefix} · ${name[0].toUpperCase()+name.slice(1)}`,
    category, family:category, variant:i,
    width: category==="mat" ? 9+(i%4)*2 : category==="instant" ? 7+(i%3)*2 : 3+(i%5)*1.35,
    primary:palette[category][0], secondary:palette[category][1]
  }))
);

export const frameById = id => FRAME_PRESETS.find(f=>f.id===id) || FRAME_PRESETS[0];
export const framesInCategory = id => FRAME_PRESETS.filter(f=>f.category===id);
