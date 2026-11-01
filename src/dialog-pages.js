export function dialoguePages(text, limit = 78) {
  const pages = [];
  let page = '';
  for (const sentence of String(text).match(/[^。！？\n]+[。！？]?|\n/g) || []) {
    if (page.length + sentence.length > limit && page.trim()) { pages.push(page.trim()); page = ''; }
    let rest = sentence;
    while (rest.length > limit) { pages.push(rest.slice(0, limit)); rest = rest.slice(limit); }
    page += rest;
  }
  if (page.trim()) pages.push(page.trim());
  return pages.length ? pages : ['…'];
}

export function speakerPortrait(speaker) {
  return [['奶奶', 'grandma'], ['阿花', 'flower-guide'], ['阿禾', 'herder-guide'], ['阿山叔', 'forager-guide'], ['大叔', 'uncle']].find(([name]) => speaker.includes(name))?.[1];
}
