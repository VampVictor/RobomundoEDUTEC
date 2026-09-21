(() => {
    'use strict';

    // Tudo usa segundos e coordenadas lógicas: o tamanho da tela não muda a física.
    const CONFIG = {
        largura: 1000, altura: 500, margem: 50, velocidade: 245,
        raioPlayer: 16, vidas: 3, invencibilidade: 1.8,
        combate: 32, revanche: 14, aviso: 1.4, intervalo: 1.3,
        transicao: 1, morte: 2.5
    };
    const PERGUNTAS = [
        {
            titulo: 'Quais áreas a robótica combina para criar suas máquinas?',
            alternativas: ['Astronomia, geografia e literatura.', 'Mecânica, eletrônica e programação.', 'Pintura, música e fotografia.', 'Apenas mecânica e desenho.'],
            correta: 1, fonte: 'O que é Robótica? · introdução',
            explicacao: 'A robótica combina mecânica, eletrônica e programação.'
        },
        {
            titulo: 'Na etapa de entrada, o que capta luz, distância e temperatura?',
            alternativas: ['Motores.', 'Atuadores.', 'Sensores.', 'Engrenagens.'],
            correta: 2, fonte: 'O que é Robótica? · Entrada',
            explicacao: 'Sensores captam informações do ambiente; motores e atuadores realizam a ação.'
        },
        {
            titulo: 'Todo robô precisa de inteligência artificial para funcionar?',
            alternativas: ['Sim, até os mais simples.', 'Sim, se tiver motores.', 'Não, pois nenhum robô usa IA.', 'Não. Muitos seguem instruções programadas.'],
            correta: 3, fonte: 'O que é Robótica? · aviso sobre IA',
            explicacao: 'Nem todo robô usa inteligência artificial. Muitos seguem instruções programadas.'
        },
        {
            titulo: 'Que tipo de robô é enviado a lugares perigosos ou difíceis de acessar para estudar o ambiente?',
            alternativas: ['Robô explorador.', 'Robô de serviço doméstico.', 'Robô educacional.', 'Robô de montagem industrial.'],
            correta: 0, fonte: 'Tipos de Robôs · Robôs Exploradores',
            explicacao: 'Exploradores estudam ambientes arriscados para humanos, como o espaço e o fundo do mar.'
        },
        {
            titulo: 'Além dos avanços tecnológicos, que questões precisam ser discutidas no futuro da robótica?',
            alternativas: ['Apenas a aparência dos robôs.', 'Segurança, privacidade e responsabilidade.', 'Somente a velocidade das máquinas.', 'A eliminação de todas as regras.'],
            correta: 1, fonte: 'Robótica no Futuro · Impactos e desafios',
            explicacao: 'O site destaca segurança, privacidade e responsabilidade no desenvolvimento e uso dos robôs.'
        }
    ];
    const $ = id => document.getElementById(id);
    const canvas = $('jogo');
    const ctx = canvas.getContext('2d');
    const telas = ['tela-inicio', 'tela-pergunta', 'tela-pausa', 'tela-fim'];
    const teclas = new Set();
    const movimentos = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
    const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const boss = { x: 815, y: 250, hp: 100, flash: 0 };
    const player = { x: 230, y: 250, hp: 3, imune: 0, passo: 0, andando: false };
    let estado = 'inicio';
    let estadoAntesPausa = 'combate';
    let tempoEstado = 0;
    let tempoFase = 0;
    let duracaoFase = CONFIG.combate;
    let tempoTotal = 0;
    let esperaAtaque = 2;
    let sequenciaAtaque = 0;
    let ataques = [];
    let particulas = [];
    let fila = [];
    let resolvidas = new Set();
    let perguntaAtual = 0;
    let perguntasExibidas = new Set();
    let erros = 0;
    let tremor = 0;
    let ultimoFrame = 0;
    let tempoVisual = 0;
    let audio = null;
    let mudo = false;
    let ultimaVidaHUD = -1;
    let ultimoHpHUD = -1;

    // Áudio sintetizado localmente. Falta de suporte nunca impede a partida.
    function iniciarAudio() {
        try {
            const Audio = window.AudioContext || window.webkitAudioContext;
            if (!audio && Audio) audio = new Audio();
            if (audio?.state === 'suspended') audio.resume().catch(() => {});
        } catch (_) { audio = null; }
    }
    function som(tipo) {
        if (mudo || !audio || audio.state !== 'running') return;
        const notas = { dano: [140, 80], acerto: [440, 660, 880], erro: [200, 130], ataque: [180], vitoria: [440, 554, 660, 880], derrota: [260, 195, 130] }[tipo];
        notas.forEach((frequencia, i) => {
            const oscilador = audio.createOscillator();
            const volume = audio.createGain();
            const inicio = audio.currentTime + i * 0.1;
            oscilador.type = tipo === 'dano' ? 'triangle' : 'sine';
            oscilador.frequency.setValueAtTime(frequencia, inicio);
            volume.gain.setValueAtTime(0, inicio);
            volume.gain.linearRampToValueAtTime(0.045, inicio + 0.015);
            volume.gain.exponentialRampToValueAtTime(0.001, inicio + 0.18);
            oscilador.connect(volume); volume.connect(audio.destination);
            oscilador.start(inicio); oscilador.stop(inicio + 0.2);
            oscilador.onended = () => { oscilador.disconnect(); volume.disconnect(); };
        });
    }
    function mostrarTela(id) {
        $('camada').hidden = !id;
        telas.forEach(tela => { $(tela).hidden = tela !== id; });
    }
    function mudarEstado(novo) {
        estado = novo;
        tempoEstado = 0;
        teclas.clear();
        player.andando = false;
        $('pausa').disabled = !['combate', 'transicao', 'pausa'].includes(novo);
        $('pausa').textContent = novo === 'pausa' ? 'Retomar' : 'Pausar';
    }
    function iniciarJogo() {
        iniciarAudio();
        Object.assign(player, { x: 230, y: 250, hp: CONFIG.vidas, imune: 1.5, passo: 0, andando: false });
        Object.assign(boss, { hp: 100, flash: 0 });
        tempoFase = 0; tempoTotal = 0; duracaoFase = CONFIG.combate;
        esperaAtaque = 2; sequenciaAtaque = 0; erros = 0; tremor = 0;
        ataques = []; particulas = []; resolvidas = new Set(); fila = PERGUNTAS.map((_, i) => i);
        perguntaAtual = 0; perguntasExibidas = new Set(); ultimoFrame = 0;
        $('aviso-ataque').textContent = 'SISTEMAS ONLINE · Prepare-se!';
        mostrarTela(null); mudarEstado('combate'); atualizarHUD(); canvas.focus({ preventScroll: true });
    }
    function dificuldade() { return resolvidas.size >= 4 ? 2 : resolvidas.size >= 2 ? 1 : 0; }
    function atualizarHUD() {
        if (ultimaVidaHUD !== player.hp) {
            $('vidas').textContent = '♥ '.repeat(player.hp) + '♡ '.repeat(CONFIG.vidas - player.hp);
            $('vidas').setAttribute('aria-label', `${player.hp} de ${CONFIG.vidas} vidas`);
            ultimaVidaHUD = player.hp;
        }
        if (ultimoHpHUD !== boss.hp) {
            $('boss-valor').textContent = `${boss.hp}%`;
            $('boss-barra').setAttribute('aria-valuenow', boss.hp);
            $('boss-preenchimento').style.width = `${boss.hp}%`;
            ultimoHpHUD = boss.hp;
        }
        $('fase').textContent = `FASE ${String(Math.min(5, resolvidas.size + 1)).padStart(2, '0')} / 05`;
        $('acertos').textContent = `${resolvidas.size} / 5`;
        $('tempo-preenchimento').style.width = `${Math.min(100, tempoFase / duracaoFase * 100)}%`;
        if (estado === 'combate') $('tempo-desafio').textContent = `DESAFIO EM ${Math.max(0, Math.ceil(duracaoFase - tempoFase))}s`;
    }
    function emitirParticulas(x, y, cor, quantidade = 20) {
        for (let i = 0; i < quantidade; i++) {
            const angulo = Math.random() * Math.PI * 2;
            const velocidade = 40 + Math.random() * 160;
            particulas.push({ x, y, vx: Math.cos(angulo) * velocidade, vy: Math.sin(angulo) * velocidade, vida: 0.5 + Math.random() * 0.6, cor });
        }
    }
    function receberDano() {
        if (estado !== 'combate' || player.imune > 0) return;
        player.hp--; player.imune = CONFIG.invencibilidade;
        tremor = 0.22; som('dano'); emitirParticulas(player.x, player.y, '#8bddff');
        atualizarHUD();
        if (player.hp <= 0) finalizar(false);
    }
    function finalizar(venceu) {
        ataques = []; tremor = 0;
        mudarEstado(venceu ? 'vitoria' : 'derrota'); mostrarTela('tela-fim');
        $('aviso-ataque').textContent = '';
        $('fim-etiqueta').textContent = venceu ? 'MISSÃO CONCLUÍDA' : 'CONEXÃO INTERROMPIDA';
        $('fim-simbolo').textContent = venceu ? '✦' : '↻';
        $('fim-titulo').textContent = venceu ? 'Laboratório protegido!' : 'Game Over';
        $('fim-texto').textContent = venceu ? 'Você desativou Ômega com conhecimento. A robótica está em boas mãos.' : 'Seu robô ficou sem energia. Observe os avisos e tente uma nova estratégia.';
        $('fim-estatisticas').textContent = `${resolvidas.size}/5 desafios · ${erros} erro(s) · ${Math.floor(tempoTotal / 60)}min ${String(Math.floor(tempoTotal % 60)).padStart(2, '0')}s de combate`;
        $('tempo-desafio').textContent = venceu ? 'MISSÃO CONCLUÍDA' : 'TENTE NOVAMENTE';
        som(venceu ? 'vitoria' : 'derrota'); $('reiniciar').focus({ preventScroll: true });
    }

    // Uma fila mantém cada questão errada disponível até que as cinco sejam acertadas.
    function abrirPergunta() {
        ataques = []; perguntaAtual = fila.shift(); perguntasExibidas.add(perguntaAtual);
        mudarEstado('pergunta'); mostrarTela('tela-pergunta');
        const pergunta = PERGUNTAS[perguntaAtual];
        $('pergunta-titulo').textContent = pergunta.titulo;
        $('pergunta-contador').textContent = `NÚCLEO ${perguntaAtual + 1} / 5`;
        $('fonte-pergunta').textContent = `Conteúdo: ${pergunta.fonte}`;
        $('feedback').textContent = ''; $('feedback').className = 'feedback';
        $('continuar').hidden = true;
        $('alternativas').replaceChildren();
        pergunta.alternativas.forEach((alternativa, i) => {
            const botao = document.createElement('button');
            botao.className = 'alternativa';
            const letra = document.createElement('b'); letra.textContent = 'ABCD'[i];
            const texto = document.createElement('span'); texto.textContent = alternativa;
            botao.append(letra, texto); botao.addEventListener('click', () => responder(i));
            $('alternativas').append(botao);
        });
        $('aviso-ataque').textContent = '';
        $('tempo-desafio').textContent = 'BATALHA PAUSADA';
        $('pergunta-titulo').focus({ preventScroll: true });
    }
    function responder(indice) {
        if (estado !== 'pergunta') return;
        const pergunta = PERGUNTAS[perguntaAtual];
        const acertou = indice === pergunta.correta;
        mudarEstado('resposta');
        Array.from($('alternativas').children).forEach((botao, i) => {
            botao.disabled = true;
            if (i === pergunta.correta) botao.classList.add('correta');
            else if (i === indice) botao.classList.add('errada');
        });
        const titulo = document.createElement('strong');
        titulo.textContent = acertou ? 'RESPOSTA CORRETA! −20% NO CHEFE' : 'RESPOSTA INCORRETA';
        const detalhe = document.createElement('span');
        if (acertou) {
            resolvidas.add(perguntaAtual); boss.hp = 100 - resolvidas.size * 20;
            boss.flash = 0.8; player.hp = Math.min(CONFIG.vidas, player.hp + 1);
            emitirParticulas(boss.x, boss.y, '#70d8ff', 45); som('acerto');
            detalhe.textContent = 'Núcleo desativado. Seu robô recuperou até 1 ponto de vida.';
        } else {
            fila.push(perguntaAtual); erros++; player.hp = Math.max(1, player.hp - 1);
            detalhe.textContent = `${pergunta.explicacao} −1 vida (a última é preservada). Você terá outra chance.`;
            $('feedback').classList.add('erro'); som('erro');
        }
        $('feedback').replaceChildren(titulo, detalhe);
        $('continuar').textContent = boss.hp === 0 ? 'Desativar Ômega ↗' : 'Voltar à batalha ↗';
        $('continuar').hidden = false; $('continuar').focus({ preventScroll: true }); atualizarHUD();
    }
    function continuar() {
        if (estado !== 'resposta') return;
        mostrarTela(null);
        if (boss.hp === 0) {
            mudarEstado('morte'); tremor = 0.6; emitirParticulas(boss.x, boss.y, '#ffad83', 70);
            $('aviso-ataque').textContent = 'ÔMEGA DESATIVADO · Laboratório seguro';
        } else {
            tempoFase = 0;
            // Após mostrar as 5 principais, as pendentes voltam em rodadas mais curtas.
            duracaoFase = perguntasExibidas.size === 5 ? CONFIG.revanche : CONFIG.combate;
            ataques = []; esperaAtaque = 2; player.imune = CONFIG.invencibilidade;
            mudarEstado('combate'); $('aviso-ataque').textContent = 'SISTEMAS ONLINE · Continue em movimento';
        }
        atualizarHUD(); canvas.focus({ preventScroll: true });
    }
    function pausar() {
        if (estado === 'pausa') {
            const tempoSalvo = tempoEstadoPausado;
            mudarEstado(estadoAntesPausa); tempoEstado = tempoSalvo;
            mostrarTela(null); canvas.focus({ preventScroll: true });
        } else if (['combate', 'transicao'].includes(estado)) {
            estadoAntesPausa = estado; tempoEstadoPausado = tempoEstado;
            mudarEstado('pausa'); mostrarTela('tela-pausa'); $('retomar').focus({ preventScroll: true });
        }
    }
    let tempoEstadoPausado = 0;

    // Ataques nunca usam setInterval/setTimeout. Só avançam no estado de combate.
    function criarAtaque() {
        const tipo = ['projetil', 'chuva', 'laser', 'onda'][sequenciaAtaque++ % 4];
        const nivel = dificuldade();
        const ataque = { tipo, idade: 0, aviso: CONFIG.aviso - nivel * 0.1, ativado: false };
        if (tipo === 'projetil') {
            ataque.angulo = Math.atan2(player.y - boss.y, player.x - boss.x);
            ataque.balas = [];
            const quantidade = nivel === 0 ? 1 : 3;
            for (let i = 0; i < quantidade; i++) {
                const angulo = ataque.angulo + (i - (quantidade - 1) / 2) * 0.25;
                ataque.balas.push({ x: boss.x - 15, y: boss.y, vx: Math.cos(angulo) * (225 + nivel * 28), vy: Math.sin(angulo) * (225 + nivel * 28) });
            }
            ataque.duracao = 4.5;
            $('aviso-ataque').textContent = 'MIRA TRAVADA · Saia da trajetória';
        } else if (tipo === 'chuva') {
            ataque.pontos = [{ x: player.x, y: player.y }];
            for (let i = 0; i < 3 + nivel; i++) ataque.pontos.push({ x: 90 + Math.random() * 820, y: 70 + Math.random() * 360 });
            ataque.duracao = 0.65;
            $('aviso-ataque').textContent = 'CHUVA DE ENERGIA · Saia dos círculos';
        } else if (tipo === 'laser') {
            ataque.horizontal = sequenciaAtaque % 8 < 4;
            ataque.posicao = ataque.horizontal ? player.y : player.x;
            ataque.largura = 38 + nivel * 8; ataque.duracao = 0.75;
            $('aviso-ataque').textContent = 'LASER CARREGANDO · Saia da faixa';
        } else {
            ataque.x = 500; ataque.y = 250; ataque.raio = 0;
            ataque.seguro = Math.atan2(player.y - ataque.y, player.x - ataque.x);
            ataque.abertura = 0.6; ataque.duracao = 3.5;
            $('aviso-ataque').textContent = 'ONDA DE CHOQUE · Fique no setor azul';
        }
        ataques.push(ataque);
    }
    const distancia = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
    const diferencaAngular = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    function atualizarAtaques(dt) {
        for (const ataque of ataques) {
            ataque.idade += dt;
            if (ataque.idade < ataque.aviso) continue;
            if (!ataque.ativado) { ataque.ativado = true; som('ataque'); }
            if (ataque.tipo === 'projetil') {
                for (const bala of ataque.balas) {
                    bala.x += bala.vx * dt; bala.y += bala.vy * dt;
                    if (distancia(player.x, player.y, bala.x, bala.y) < CONFIG.raioPlayer + 8) receberDano();
                }
            } else if (ataque.tipo === 'chuva') {
                for (const ponto of ataque.pontos) if (distancia(player.x, player.y, ponto.x, ponto.y) < 42 + CONFIG.raioPlayer) receberDano();
            } else if (ataque.tipo === 'laser') {
                const coordenada = ataque.horizontal ? player.y : player.x;
                if (Math.abs(coordenada - ataque.posicao) < ataque.largura / 2 + CONFIG.raioPlayer) receberDano();
            } else {
                ataque.raio = (ataque.idade - ataque.aviso) * (180 + dificuldade() * 15);
                const angulo = Math.atan2(player.y - ataque.y, player.x - ataque.x);
                const foraDoSetor = Math.abs(diferencaAngular(angulo, ataque.seguro)) > ataque.abertura - 0.05;
                if (foraDoSetor && Math.abs(distancia(player.x, player.y, ataque.x, ataque.y) - ataque.raio) < CONFIG.raioPlayer + 9) receberDano();
            }
            if (estado !== 'combate') return;
        }
        ataques = ataques.filter(a => a.idade < a.aviso + a.duracao);
        if (!ataques.length) {
            esperaAtaque -= dt;
            if (esperaAtaque <= 0) { criarAtaque(); esperaAtaque = CONFIG.intervalo - dificuldade() * 0.2; }
        }
    }
    function moverPlayer(dt) {
        let dx = Number(teclas.has('KeyD') || teclas.has('ArrowRight')) - Number(teclas.has('KeyA') || teclas.has('ArrowLeft'));
        let dy = Number(teclas.has('KeyS') || teclas.has('ArrowDown')) - Number(teclas.has('KeyW') || teclas.has('ArrowUp'));
        const tamanho = Math.hypot(dx, dy);
        player.andando = tamanho > 0;
        if (tamanho) { dx /= tamanho; dy /= tamanho; player.passo += dt * 14; }
        player.x = Math.max(CONFIG.margem, Math.min(CONFIG.largura - CONFIG.margem, player.x + dx * CONFIG.velocidade * dt));
        player.y = Math.max(CONFIG.margem, Math.min(CONFIG.altura - CONFIG.margem, player.y + dy * CONFIG.velocidade * dt));
    }
    function atualizar(dt) {
        if (['combate', 'morte', 'resposta', 'vitoria', 'derrota', 'inicio'].includes(estado)) {
            tempoVisual += dt; boss.flash = Math.max(0, boss.flash - dt); tremor = Math.max(0, tremor - dt);
            particulas.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt; });
            particulas = particulas.filter(p => p.vida > 0);
        }
        if (estado === 'combate') {
            tempoEstado += dt; tempoFase += dt; tempoTotal += dt; player.imune = Math.max(0, player.imune - dt);
            if (tempoFase >= duracaoFase) {
                ataques = []; mudarEstado('transicao'); $('aviso-ataque').textContent = 'CONEXÃO ESTABELECIDA · Preparando desafio';
                return;
            }
            moverPlayer(dt); atualizarAtaques(dt); atualizarHUD();
        } else if (estado === 'transicao') {
            tempoEstado += dt;
            if (tempoEstado >= CONFIG.transicao) abrirPergunta();
        } else if (estado === 'morte') {
            tempoEstado += dt;
            if (tempoEstado >= CONFIG.morte) finalizar(true);
        }
    }

    // Desenho: robôs e cenário são vetoriais locais, sem downloads de sprites.
    function retangulo(x, y, w, h, raio, cor) {
        ctx.fillStyle = cor; ctx.beginPath(); ctx.roundRect(x, y, w, h, raio); ctx.fill();
    }
    function circulo(x, y, raio, cor) { ctx.beginPath(); ctx.arc(x, y, raio, 0, Math.PI * 2); ctx.fillStyle = cor; ctx.fill(); }
    function linha(x1, y1, x2, y2, cor, largura = 1) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = cor; ctx.lineWidth = largura; ctx.stroke(); }
    function desenharCenario() {
        const gradiente = ctx.createRadialGradient(490, 250, 20, 500, 250, 570);
        gradiente.addColorStop(0, '#11375a'); gradiente.addColorStop(1, '#06172e');
        ctx.fillStyle = gradiente; ctx.fillRect(0, 0, 1000, 500);
        for (let x = 20; x < 1000; x += 40) linha(x, 0, x, 500, '#497eac12');
        for (let y = 10; y < 500; y += 40) linha(0, y, 1000, y, '#497eac12');
        ctx.strokeStyle = '#4a88ba38'; ctx.lineWidth = 2; ctx.strokeRect(22, 22, 956, 456);
        for (const [x, y, dx, dy] of [[22, 22, 1, 1], [978, 22, -1, 1], [22, 478, 1, -1], [978, 478, -1, -1]]) {
            linha(x, y, x + dx * 40, y, '#58bdff', 3); linha(x, y, x, y + dy * 25, '#58bdff', 3);
        }
        ctx.save(); ctx.translate(500, 250);
        ctx.strokeStyle = '#5688b326'; ctx.lineWidth = 1;
        for (const raio of [83, 92, 190]) { ctx.beginPath(); ctx.arc(0, 0, raio, 0, Math.PI * 2); ctx.stroke(); }
        ctx.setLineDash([5, 12]); ctx.beginPath(); ctx.arc(0, 0, 180, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = '#6a96b71c'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.fillText('RM / 07', 500, 258);
        for (let y = 90; y < 430; y += 80) {
            retangulo(6, y, 5, 32, 2, '#66caff55'); retangulo(989, y, 5, 32, 2, '#ff698955');
        }
    }
    function desenharRobo(x, y, mal = false) {
        const escala = mal ? 2.05 : 0.9;
        ctx.save(); ctx.translate(x, y);
        if (mal && estado === 'morte') { ctx.rotate(Math.sin(tempoEstado * 24) * .09); ctx.globalAlpha = Math.max(0, 1 - tempoEstado / CONFIG.morte); }
        if (!mal && player.imune > 0 && estado === 'combate') ctx.globalAlpha = Math.sin(tempoVisual * 30) > 0 ? 0.5 : 1;
        ctx.scale(escala, escala);
        ctx.fillStyle = '#020d2166'; ctx.beginPath(); ctx.ellipse(0, 30, 29, 8, 0, 0, Math.PI * 2); ctx.fill();
        const balanco = reduzirMovimento ? 0 : (mal ? Math.sin(tempoVisual * 2) * 2 : player.andando ? Math.sin(player.passo) * 2 : Math.sin(tempoVisual * 3));
        ctx.translate(0, balanco);
        const metal = mal ? '#546781' : '#cdeaff';
        const brilho = mal ? '#ff687e' : '#6cdcff';
        const escuro = mal ? '#273853' : '#4f93c2';
        const passo = !mal && player.andando ? Math.sin(player.passo) * 4 : 0;
        retangulo(-18, 15 + passo, 14, 17, 4, escuro); retangulo(4, 15 - passo, 14, 17, 4, escuro);
        retangulo(-20, 27 + passo, 18, 6, 2, metal); retangulo(3, 27 - passo, 18, 6, 2, metal);
        retangulo(-31, -7, 11, 29, 5, escuro); retangulo(20, -7, 11, 29, 5, escuro);
        circulo(-25, -7, 8, metal); circulo(25, -7, 8, metal);
        retangulo(-20, -10, 40, 34, 9, metal); retangulo(-13, -3, 26, 18, 5, escuro);
        ctx.shadowColor = brilho; ctx.shadowBlur = 12;
        circulo(0, 6, mal ? 6 : 5, brilho); ctx.shadowBlur = 0;
        linha(0, -37, 0, -48, metal, 3); circulo(0, -49, 4, brilho);
        retangulo(-25, -36, 50, 31, mal ? 5 : 12, metal);
        retangulo(-20, -30, 40, 20, mal ? 3 : 9, '#06172e');
        if (mal) {
            linha(-15, -24, -5, -20, brilho, 4); linha(5, -20, 15, -24, brilho, 4);
            ctx.fillStyle = '#8294ab'; ctx.beginPath(); ctx.moveTo(-25, -34); ctx.lineTo(-31, -47); ctx.lineTo(-13, -36); ctx.fill();
            ctx.beginPath(); ctx.moveTo(25, -34); ctx.lineTo(31, -47); ctx.lineTo(13, -36); ctx.fill();
        } else { circulo(-9, -21, 3.7, brilho); circulo(9, -21, 3.7, brilho); linha(-4, -15, 4, -15, '#75d9ff', 2); }
        if (mal && boss.flash > 0) { ctx.globalAlpha = boss.flash * 0.6; retangulo(-32, -40, 64, 76, 10, '#ceefff'); }
        ctx.restore();
        if (!mal && player.imune > 0 && estado === 'combate') { ctx.strokeStyle = '#79d9ff88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 38, 0, Math.PI * 2); ctx.stroke(); }
        if (!mal) { ctx.fillStyle = '#a4dfff'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText('NEO / VOCÊ', x, y + 47); }
    }
    function desenharAtaques() {
        for (const a of ataques) {
            const aviso = a.idade < a.aviso;
            const pulso = 0.5 + Math.sin(a.idade * 12) * 0.15;
            ctx.save();
            if (a.tipo === 'projetil') {
                if (aviso) {
                    ctx.setLineDash([9, 9]); ctx.globalAlpha = pulso;
                    for (const bala of a.balas) linha(bala.x, bala.y, bala.x + bala.vx * 5, bala.y + bala.vy * 5, '#ffd18b', 2);
                    ctx.setLineDash([]); circulo(boss.x - 15, boss.y, 13 + a.idade * 5, '#ffb66a66');
                } else for (const bala of a.balas) { ctx.shadowColor = '#ff9476'; ctx.shadowBlur = 14; circulo(bala.x, bala.y, 8, '#ffa382'); circulo(bala.x, bala.y, 3, '#fff3d8'); }
            } else if (a.tipo === 'chuva') {
                for (const p of a.pontos) {
                    circulo(p.x, p.y, 42, aviso ? `rgba(255,174,95,${pulso * .2})` : '#ffb27bbb');
                    ctx.strokeStyle = aviso ? '#ffc283' : '#ffe1b0'; ctx.lineWidth = aviso ? 2 : 4;
                    ctx.beginPath(); ctx.arc(p.x, p.y, 42, 0, Math.PI * 2); ctx.stroke();
                    if (aviso) { linha(p.x - 8, p.y, p.x + 8, p.y, '#ffd39b', 2); linha(p.x, p.y - 8, p.x, p.y + 8, '#ffd39b', 2); }
                }
            } else if (a.tipo === 'laser') {
                ctx.fillStyle = aviso ? `rgba(255,100,130,${pulso * .3})` : '#ff6884aa';
                ctx.strokeStyle = '#ff96a9'; ctx.lineWidth = 2; ctx.setLineDash(aviso ? [12, 7] : []);
                if (a.horizontal) { ctx.fillRect(22, a.posicao - a.largura / 2, 956, a.largura); ctx.strokeRect(22, a.posicao - a.largura / 2, 956, a.largura); if (!aviso) linha(22, a.posicao, 978, a.posicao, '#fff0f8', 5); }
                else { ctx.fillRect(a.posicao - a.largura / 2, 22, a.largura, 456); ctx.strokeRect(a.posicao - a.largura / 2, 22, a.largura, 456); if (!aviso) linha(a.posicao, 22, a.posicao, 478, '#fff0f8', 5); }
            } else {
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, 1150, a.seguro - a.abertura, a.seguro + a.abertura); ctx.closePath(); ctx.fillStyle = '#42caff17'; ctx.fill();
                for (const lado of [-1, 1]) linha(a.x, a.y, a.x + Math.cos(a.seguro + lado * a.abertura) * 1150, a.y + Math.sin(a.seguro + lado * a.abertura) * 1150, '#60daff88', 2);
                ctx.beginPath(); ctx.arc(a.x, a.y, aviso ? 22 + a.idade * 12 : a.raio, a.seguro + a.abertura, a.seguro + Math.PI * 2 - a.abertura);
                ctx.strokeStyle = aviso ? '#ffc283' : '#ffad7e'; ctx.lineWidth = aviso ? 3 : 16; ctx.stroke();
                circulo(a.x, a.y, 9, '#ffc283');
            }
            ctx.restore();
        }
    }
    function desenhar() {
        ctx.save();
        if (tremor > 0 && !reduzirMovimento) ctx.translate((Math.random() - .5) * 7, (Math.random() - .5) * 7);
        desenharCenario(); desenharAtaques();
        if (estado !== 'vitoria') desenharRobo(boss.x, boss.y, true);
        desenharRobo(player.x, player.y);
        for (const p of particulas) { ctx.globalAlpha = Math.min(1, p.vida); circulo(p.x, p.y, 2.5, p.cor); }
        ctx.globalAlpha = 1;
        if (estado === 'transicao') { ctx.fillStyle = `rgba(53,158,255,${Math.sin(tempoEstado / CONFIG.transicao * Math.PI) * .2})`; ctx.fillRect(0, 0, 1000, 500); }
        ctx.restore();
    }
    function loop(agora) {
        const dt = ultimoFrame ? Math.min((agora - ultimoFrame) / 1000, 0.04) : 0;
        ultimoFrame = agora; atualizar(dt); desenhar(); requestAnimationFrame(loop);
    }

    $('jogar').addEventListener('click', iniciarJogo);
    $('reiniciar').addEventListener('click', iniciarJogo);
    $('continuar').addEventListener('click', continuar);
    $('pausa').addEventListener('click', pausar);
    $('retomar').addEventListener('click', pausar);
    $('som').addEventListener('click', () => { iniciarAudio(); mudo = !mudo; $('som').textContent = mudo ? 'Som: desligado' : 'Som: ligado'; $('som').setAttribute('aria-pressed', mudo); $('som').setAttribute('aria-label', mudo ? 'Ativar sons' : 'Silenciar sons'); });
    window.addEventListener('keydown', evento => {
        if (evento.code === 'Escape' && !evento.repeat) { pausar(); return; }
        if (movimentos.includes(evento.code) && estado === 'combate') {
            evento.preventDefault(); teclas.add(evento.code);
        }
    });
    window.addEventListener('keyup', evento => teclas.delete(evento.code));
    function perderFoco() { teclas.clear(); if (['combate', 'transicao'].includes(estado)) pausar(); }
    window.addEventListener('blur', perderFoco);
    document.addEventListener('visibilitychange', () => { if (document.hidden) perderFoco(); ultimoFrame = 0; });
    document.querySelectorAll('[data-direcao]').forEach(botao => {
        botao.addEventListener('pointerdown', evento => { if (estado !== 'combate') return; evento.preventDefault(); botao.setPointerCapture(evento.pointerId); teclas.add(botao.dataset.direcao); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(tipo => botao.addEventListener(tipo, () => teclas.delete(botao.dataset.direcao)));
    });
    atualizarHUD(); requestAnimationFrame(loop);
})();
