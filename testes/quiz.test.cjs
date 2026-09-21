// Execute: node --test testes/quiz.test.cjs (sem instalar pacotes).
// O VM exercita o mesmo código do jogo, com DOM/Canvas mínimos; não substitui o teste visual.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '..');
function ambiente() {
    class Elemento {
        constructor() { this.children = []; this.hidden = false; this.style = {}; this.attrs = {}; this.handlers = {}; this.classList = { add() {} }; }
        setAttribute(k,v) { this.attrs[k] = String(v); }
        append(...items) { this.children.push(...items); }
        replaceChildren(...items) { this.children = items; }
        addEventListener(k, fn) { this.handlers[k] = fn; }
        focus() {} setPointerCapture() {}
    }
    const elementos = {};
    const desenho = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({addColorStop(){}}) : () => {} });
    const document = { getElementById: id => elementos[id] ||= new Elemento(), createElement: () => new Elemento(), querySelectorAll: () => [], addEventListener() {} };
    document.getElementById('jogo').getContext = () => desenho;
    const listeners = {};
    const window = { matchMedia: () => ({matches:false}), addEventListener: (k, fn) => listeners[k] = fn };
    let frames = 0;
    const sandbox = { document, window, requestAnimationFrame: () => frames++, console };
    const fonte = fs.readFileSync(path.join(raiz, 'quiz.js'), 'utf8').replace(/\}\)\(\);\s*$/, `
        globalThis.teste = { CONFIG, PERGUNTAS, player, boss, teclas, iniciarJogo, atualizar, desenhar, criarAtaque, receberDano, abrirPergunta, responder, continuar, pausar, dificuldade, loop,
        get estado(){return estado}, get ataques(){return ataques}, get fila(){return fila}, get perguntaAtual(){return perguntaAtual}, get resolvidas(){return resolvidas}, get tempoFase(){return tempoFase}, get duracaoFase(){return duracaoFase}, get particulas(){return particulas} };
    })();`);
    vm.runInNewContext(fonte, sandbox);
    return { jogo: sandbox.teste, elementos, listeners, frames: () => frames };
}
function avancar(g, segundos) { for (let t=0;t<segundos;t+=1/60) g.atualizar(1/60); }

test('início, WASD, setas, diagonal normalizada e limites do sprite', () => {
    const {jogo:g,elementos:e,listeners} = ambiente();
    assert.equal(g.estado,'inicio'); e.jogar.handlers.click(); assert.equal(g.estado,'combate');
    for (const [code, eixo, sinal] of [['KeyD','x',1],['KeyA','x',-1],['KeyW','y',-1],['KeyS','y',1],['ArrowRight','x',1],['ArrowLeft','x',-1],['ArrowUp','y',-1],['ArrowDown','y',1]]) {
        g.player.x=500;g.player.y=250; const antes=g.player[eixo];
        listeners.keydown({code, preventDefault(){}});g.atualizar(.1);listeners.keyup({code});
        assert.ok((g.player[eixo]-antes)*sinal>0,code);
    }
    g.player.x=500;g.player.y=250;g.teclas.add('KeyD');g.teclas.add('KeyW');g.atualizar(.1);
    assert.ok(Math.abs(Math.hypot(g.player.x-500,g.player.y-250)-24.5)<.001);
    g.teclas.clear();
    for (const code of ['KeyA','KeyD','KeyW','KeyS']) {g.teclas.add(code); for(let i=0;i<100;i++)g.atualizar(.04);g.teclas.clear(); assert.ok(g.player.x>=50&&g.player.x<=950&&g.player.y>=50&&g.player.y<=450);}
});
test('colisão, invencibilidade e derrota; reinício limpa todos os estados', () => {
    const {jogo:g,elementos:e,frames} = ambiente();g.iniciarJogo();g.player.imune=0;
    g.receberDano();assert.equal(g.player.hp,2);g.receberDano();assert.equal(g.player.hp,2);
    avancar(g,1.9);g.receberDano();assert.equal(g.player.hp,1);g.player.imune=0;g.receberDano();
    assert.equal(g.estado,'derrota');assert.equal(g.ataques.length,0);avancar(g,10);assert.equal(g.player.hp,0);
    e.reiniciar.handlers.click();assert.equal(g.estado,'combate');assert.equal(g.player.hp,3);assert.equal(g.boss.hp,100);assert.equal(g.ataques.length,0);assert.equal(g.particulas.length,0);assert.equal(g.tempoFase,0);assert.equal(frames(),1);
});
test('quatro padrões: aviso sem dano, colisão ativa e região segura', () => {
    for(const tipo of ['projetil','chuva','laser','onda']){
        const {jogo:g}=ambiente();g.iniciarJogo();g.player.imune=0;
        do {g.criarAtaque();}while(g.ataques.at(-1).tipo!==tipo);
        const a=g.ataques.at(-1);g.ataques.splice(0,g.ataques.length-1);
        g.atualizar(.1);assert.equal(g.player.hp,3,`${tipo}: aviso`);
        if(tipo==='projetil'){g.player.x=a.balas[0].x;g.player.y=a.balas[0].y;}
        if(tipo==='onda'){g.player.x=540;g.player.y=250;a.seguro=Math.PI;a.raio=40;}
        a.idade=a.aviso+(tipo==='onda'?.2:0);g.atualizar(.01);
        assert.equal(g.player.hp,2,`${tipo}: dano`);
        g.iniciarJogo();g.player.imune=0;
        do {g.criarAtaque();}while(g.ataques.at(-1).tipo!==tipo);
        const b=g.ataques.at(-1);g.ataques.splice(0,g.ataques.length-1);
        g.player.x=90;g.player.y=80;
        if(tipo==='onda'){b.seguro=Math.atan2(80-250,90-500);}
        b.idade=b.aviso;g.atualizar(.01);assert.equal(g.player.hp,3,`${tipo}: desvio`);
    }
});
test('perguntas param batalha, têm 4 alternativas e cada botão é acionável', () => {
    for(let alternativa=0;alternativa<4;alternativa++){
        const {jogo:g,elementos:e}=ambiente();g.iniciarJogo();g.criarAtaque();g.abrirPergunta();
        const tempo=g.tempoFase, x=g.player.x;g.teclas.add('KeyD');avancar(g,10);
        assert.equal(g.tempoFase,tempo);assert.equal(g.player.x,x);assert.equal(g.ataques.length,0);
        assert.equal(e.alternativas.children.length,4);e.alternativas.children[alternativa].handlers.click();
        assert.equal(g.estado,'resposta');assert.equal(g.boss.hp,alternativa===1?80:100);
        const hp=g.boss.hp;g.responder(1);assert.equal(g.boss.hp,hp,'sem resposta duplicada');
        assert.ok(e.alternativas.children.every(b=>b.disabled));
    }
});
test('cinco erros não bloqueiam vitória: fila, penalidade não letal e revanche', () => {
    const {jogo:g}=ambiente();g.iniciarJogo();
    for(let i=0;i<5;i++){g.abrirPergunta();assert.equal(g.perguntaAtual,i);g.player.hp=1;g.responder((g.PERGUNTAS[i].correta+1)%4);assert.equal(g.player.hp,1);g.continuar();}
    assert.equal(g.fila.length,5);assert.equal(g.boss.hp,100);assert.equal(g.duracaoFase,14);
    for(let i=0;i<5;i++){g.abrirPergunta();g.responder(g.PERGUNTAS[g.perguntaAtual].correta);assert.equal(g.boss.hp,80-i*20);g.continuar();}
    assert.equal(g.estado,'morte');avancar(g,3);assert.equal(g.estado,'vitoria');
    g.iniciarJogo();assert.equal(g.resolvidas.size,0);assert.equal(g.fila.length,5);assert.equal(g.boss.hp,100);assert.equal(g.ataques.length,0);
});
test('pausa manual e perda de foco congelam combate; retomada não cria ataque oculto', () => {
    const {jogo:g,listeners}=ambiente();g.iniciarJogo();g.criarAtaque();g.atualizar(.1);
    const idade=g.ataques[0].idade;const tempo=g.tempoFase;
    listeners.blur();assert.equal(g.estado,'pausa');avancar(g,5);assert.equal(g.ataques[0].idade,idade);assert.equal(g.tempoFase,tempo);
    g.pausar();g.atualizar(.1);assert.ok(g.ataques[0].idade>idade);
});
test('partida completa usa tempos reais de simulação, progressão e animação final', () => {
    const {jogo:g}=ambiente();g.iniciarJogo();let fases=0;let segundos=0;
    // Piloto segue as áreas seguras: não remove ataques, vidas nem colisões.
    while(g.estado!=='vitoria'&&segundos<240){
        if(g.estado==='combate'){
            const a=g.ataques[0];
            if(a&&a.idade<a.aviso){
                let alvo={x:230,y:250};
                if(a.tipo==='chuva') alvo={x:a.pontos[0].x<500?800:150,y:a.pontos[0].y<250?400:90};
                if(a.tipo==='laser') alvo=a.horizontal?{x:g.player.x,y:a.posicao<250?420:80}:{x:a.posicao<500?900:100,y:g.player.y};
                if(a.tipo==='projetil') alvo={x:g.player.x,y:g.player.y<250?420:80};
                if(a.tipo==='onda') alvo={x:500+Math.cos(a.seguro)*200,y:250+Math.sin(a.seguro)*200};
                g.teclas.clear();if(alvo.x-g.player.x>8)g.teclas.add('KeyD');if(alvo.x-g.player.x<-8)g.teclas.add('KeyA');if(alvo.y-g.player.y>8)g.teclas.add('KeyS');if(alvo.y-g.player.y<-8)g.teclas.add('KeyW');
            }else g.teclas.clear();
        }
        if(g.estado==='pergunta'){g.responder(g.PERGUNTAS[g.perguntaAtual].correta);fases++;assert.equal(g.dificuldade(),fases>=4?2:fases>=2?1:0);g.continuar();}
        g.atualizar(1/60);g.desenhar();segundos+=1/60;
        assert.notEqual(g.estado,'derrota',`derrota aos ${segundos}s`);
    }
    assert.equal(g.estado,'vitoria');assert.equal(fases,5);assert.ok(segundos>=167&&segundos<170);assert.equal(g.ataques.length,0);
});
test('links e recursos locais existem; páginas antigas mudam somente o link Quiz', () => {
    const {execFileSync}=require('node:child_process');
    for(const arquivo of ['index.html','o-que-e-robotica.html','robotica-no-futuro.html','tipos-de-robo.html','quiz.html']){
        const html=fs.readFileSync(path.join(raiz,arquivo),'utf8');
        for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) if(!/^(https?:|#)/.test(url))assert.ok(fs.existsSync(path.join(raiz,url)),url);
        if(arquivo!=='quiz.html') { const original=execFileSync('git',['show',`1bc40b8:${arquivo}`],{cwd:raiz,encoding:'utf8'});assert.equal(html,original.replace('<a href="#">Quiz</a>','<a href="quiz.html">Quiz</a>')); }
    }
});
