<template>
  <div class="bank-simulation">
    <h1>Банковская симуляция</h1>

    <div class="controls">
      <div class="slider-group">
        <label>Окон всего: {{ counterCount }}</label>
        <input type="range" min="1" max="10" v-model.number="counterCount" :disabled="isRunning">
      </div>
      <div class="slider-group">
        <label>VIP окон: {{ vipCounterCount }}</label>
        <input type="range" min="0" :max="counterCount" v-model.number="vipCounterCount" :disabled="isRunning">
      </div>
      <div class="slider-group">
        <label>Окон для пенсионеров: {{ pensionerCounterCount }}</label>
        <input type="range" min="0" :max="counterCount - vipCounterCount" v-model.number="pensionerCounterCount"
          :disabled="isRunning">
      </div>
      <div class="slider-group">
        <label>Скорость обслуживания: {{ serviceSpeed }}%</label>
        <input type="range" min="50" max="200" v-model.number="serviceSpeed" :disabled="isRunning">
      </div>
      <div class="slider-group">
        <label>Интенсивность потока: {{ arrivalRate }} мс</label>
        <input type="range" min="100" max="2000" step="50" v-model.number="arrivalRate" :disabled="isRunning">
      </div>
      <div class="slider-group">
        <label>Вероятность ухода: {{ leaveChance }}%</label>
        <input type="range" min="0" max="50" v-model.number="leaveChance" :disabled="isRunning">
      </div>
      <div class="slider-group">
        <label>Доля VIP: {{ vipPercentage }}%</label>
        <input type="range" min="0" max="30" v-model.number="vipPercentage" :disabled="isRunning">
      </div>

      <div class="slider-group">
        <label>Шанс ограбления: {{ robberyChance }}%</label>
        <input type="range" min="0" max="10" v-model.number="robberyChance" :disabled="isRunning">
      </div>
      <div class="slider-group">
        <label>Охрана: {{ securityLevel }}%</label>
        <input type="range" min="0" max="100" v-model.number="securityLevel" :disabled="isRunning">
      </div>
      <div class="slider-group">
        <label>Скорость полиции: {{ policeResponseTime }} мин</label>
        <input type="range" min="1" max="10" v-model.number="policeResponseTime" :disabled="isRunning">
      </div>

      <div class="button-group">
        <button @click="startSimulation" :disabled="isRunning">Старт</button>
        <button @click="stopSimulation" :disabled="!isRunning">Стоп</button>
        <button @click="resetSimulation">Сброс</button>
        <button @click="triggerRandomEvent" :disabled="!isRunning">Случайное событие</button>
        <button @click="triggerRobbery" :disabled="!isRunning || isRobberyInProgress">Начать ограбление</button>
      </div>
    </div>

    <div class="stats">
      <div>Клиентов: {{ totalClients }}</div>
      <div>Обслужено: {{ bank.totalServed }}</div>
      <div>Свободных окон: {{ availableCounters }}</div>
      <div>Ушло клиентов: {{ leftClients }}</div>
      <div>Репутация: {{ bank.reputation }}%</div>
      <div>Касса: {{ bank.totalMoney }} ₽</div>
      <div v-if="bank.isWindingDown" class="simulation-winding">Завершение работы...</div>
      <div v-if="simulationFinished" class="simulation-finished">Симуляция завершена!</div>
      <div v-if="randomEventActive" class="random-event">Событие: {{ randomEventText }}</div>
      <div v-if="isRobberyInProgress" class="robbery-alert">
        ⚠️ ОГРАБЛЕНИЕ! Полиция прибудет через {{ policeArrivalTime }} сек
      </div>
      <div v-if="robberyResult" :class="['robbery-result', robberyResult.success ? 'success' : 'failure']">
        {{ robberyResult.message }}<br>
        Убытки: {{ robberyResult.losses }} ₽
      </div>
    </div>

    <div class="bank-visualization" ref="bankArea" :class="{ 'robbery-alert-bg': isRobberyAlarm }">
      <div class="bank-layout">
        <div class="bank-area">
          <div class="entrance-door">🚪</div>
          <div class="atm" :style="atmStyle">🏧</div>

          <div v-for="counter in bank.counters" :key="counter.id" class="service-window"
            :class="{
              'vip-counter': counter.type === 'vip',
              'pensioner-counter': counter.type === 'pensioner',
              'counter-closed': !counter.isWorking
            }" :style="{
              left: counter.position.x + 'px',
              top: counter.position.y + 'px',
              backgroundColor: counter.currentClient ? '#F44336' : counter.isWorking ? '#4CAF50' : '#9E9E9E'
            }" @click="toggleCounter(counter)">
            <span v-if="counter.currentClient">⏱️</span>
            <span v-else>{{ counter.type === 'vip' ? '⭐' : counter.type === 'pensioner' ? '👵' : '👔' }}</span>
            <div class="counter-type">{{ counter.type }}</div>
          </div>

          <transition-group name="client" tag="div">
            <div v-for="client in enteringClients" :key="'entering-' + client.id" class="client entering-client"
              :style="{
                left: client.position.x + 'px',
                top: client.position.y + 'px',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                transition: `all ${client.speed * 0.5}s ease-out`
              }">
              <span class="client-emoji">{{ getClientEmoji(client) }}</span>
            </div>

            <div v-for="client in atmClients" :key="'atm-' + client.id" class="client atm-client"
              :style="{
                left: client.position.x + 'px',
                top: client.position.y + 'px',
                transform: 'translate(-50%, -50%)',
                transition: `all ${client.speed * 0.5}s ease-out`
              }">
              <span class="client-emoji">💳</span>
            </div>

            <div v-for="client in servingClients" :key="'serving-' + client.id" class="client serving-client"
              :style="{
                left: client.position.x + 'px',
                top: client.position.y + 'px',
                transform: 'translate(-50%, -50%)',
                zIndex: 5,
                transition: `all ${client.speed * 0.5}s ease-out`
              }">
              <span class="client-emoji">{{ getClientEmoji(client) }}</span>
            </div>
          </transition-group>

          <div v-for="robber in robbers" :key="'robber-' + robber.id" class="robber"
            :style="{
              left: robber.position.x + 'px',
              top: robber.position.y + 'px',
              transform: 'translate(-50%, -50%)'
            }">
            <span class="robber-emoji">🔫</span>
            <div class="robber-status" v-if="robber.status !== 'robbing'">
              {{ robber.status === 'fleeing' ? 'Убегает' : 'Задержан' }}
            </div>
          </div>

          <div v-for="guard in guards" :key="'guard-' + guard.id" class="guard"
            :style="{
              left: guard.position.x + 'px',
              top: guard.position.y + 'px',
              transform: 'translate(-50%, -50%)'
            }">
            <span class="guard-emoji">🛡️</span>
          </div>
        </div>

        <div class="queue-area">
          <div v-for="(client, index) in bank.vipQueue" :key="'vip-' + client.id" class="client vip-client"
            :style="{
              left: (vipQueuePosition.x - index * 30) + 'px',
              top: vipQueuePosition.y + 'px',
              opacity: client.patienceLevel / 100,
              transform: 'translate(-50%, -50%)',
              transition: `all ${client.speed * 0.5}s ease-out`
            }">
            <span class="client-emoji">🎩</span>
            <div class="client-status">{{ client.serviceType }}</div>
            <div class="emotion-indicator" :class="client.emotion"></div>
          </div>

          <div v-for="(client, index) in bank.pensionerQueue" :key="'pensioner-' + client.id"
            class="client pensioner-client" :style="{
              left: (pensionerQueuePosition.x - index * 30) + 'px',
              top: pensionerQueuePosition.y + 'px',
              opacity: client.patienceLevel / 100,
              transform: 'translate(-50%, -50%)',
              transition: `all ${client.speed * 0.5}s ease-out`
            }">
            <span class="client-emoji">👵</span>
            <div class="client-status">{{ client.serviceType }}</div>
            <div class="emotion-indicator" :class="client.emotion"></div>
          </div>

          <div v-for="(client, index) in queuePositions" :key="client.id" class="client"
            :class="{ [client.emotion]: true }" :style="{
              left: (mainQueuePosition.x - index * 30) + 'px',
              top: mainQueuePosition.y + 'px',
              opacity: client.patienceLevel / 100,
              transform: 'translate(-50%, -50%)',
              transition: `all ${client.speed * 0.5}s ease-out`
            }">
            <span class="client-emoji">{{ client.type === 'vip' ? '🎩' : '🧍' }}</span>
            <div class="client-status">{{ client.serviceType }}</div>
            <div class="emotion-indicator" :class="client.emotion"></div>
          </div>

          <div v-for="client in leavingClients" :key="'leaving-' + client.id" class="client leaving-client"
            :style="{
              left: client.position.x + 'px',
              top: client.position.y + 'px',
              opacity: client.leaveProgress,
              transform: 'translate(-50%, -50%)',
              transition: `all ${client.speed * 0.5}s ease-out`
            }">
            <span class="client-emoji">{{ getClientEmoji(client) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export class Bank {
  constructor(maxCapacity) {
    this.maxCapacity = maxCapacity;
    this.clients = [];
    this.counters = [];
    this.totalServed = 0;
    this.isWindingDown = false;
    this.vipQueue = [];
    this.pensionerQueue = [];
    this.totalMoney = 1000000;
    this.reputation = 100;
  }
}

export class Counter {
  constructor(id, processTime, type = 'regular') {
    this.id = id;
    this.processTime = processTime;
    this.currentClient = null;
    this.isAvailable = true;
    this.position = { x: 0, y: 0 };
    this.type = type;
    this.isWorking = true;
  }
}

export class Client {
  static nextId = 1;
  
  constructor() {
    this.id = Client.nextId++;
    this.position = { x: 0, y: 0 };
    this.targetPosition = null;
    this.speed = 0.5 + Math.random();
    this.isWaiting = false;
    this.patience = 20000 + Math.random() * 30000;
    this.enteredTime = Date.now();
    this.isLeaving = false;
    this.served = false;
    this.serviceType = this.getRandomService();
    this.serviceTime = this.calculateServiceTime();
    this.type = this.determineClientType();
    this.emotion = 'neutral';
    this.patienceLevel = 100;
  }

  getRandomService() {
    const services = ['deposit', 'credit', 'payment', 'consultation'];
    return services[Math.floor(Math.random() * services.length)];
  }

  calculateServiceTime() {
    switch(this.serviceType) {
      case 'credit': return 8000 + Math.random() * 5000;
      case 'deposit': return 5000 + Math.random() * 3000;
      case 'consultation': return 6000 + Math.random() * 4000;
      default: return 2000 + Math.random() * 2000;
    }
  }

  determineClientType() {
    const rand = Math.random();
    if (rand < 0.1) return 'vip';
    if (rand < 0.3) return 'pensioner';
    return 'regular';
  }

  updateEmotion() {
    const waitTime = Date.now() - this.enteredTime;
    this.patienceLevel = Math.max(0, 100 - (waitTime / this.patience) * 100);
    
    if (this.patienceLevel < 20) this.emotion = 'angry';
    else if (this.patienceLevel < 50) this.emotion = 'annoyed';
    else this.emotion = 'neutral';
  }
}

export default {
  data() {
    return {
      bank: new Bank(50),
      counterCount: 5,
      vipCounterCount: 1,
      pensionerCounterCount: 1,
      serviceSpeed: 100,
      arrivalRate: 500,
      leaveChance: 10,
      vipPercentage: 10,
      isRunning: false,
      simulationFinished: false,
      intervals: [],
      animationFrame: null,
      lastUpdateTime: 0,
      totalEntered: 0,
      leftClients: 0,
      queuePositions: [],
      atmClients: [],
      enteringClients: [],
      leavingClients: [],
      servingClients: [],
      atmBroken: false,
      randomEventActive: false,
      randomEventText: '',
      vipQueuePosition: { x: 0, y: 0 },
      pensionerQueuePosition: { x: 0, y: 0 },
      mainQueuePosition: { x: 0, y: 0 },
      atmPosition: { x: 0, y: 0 },
      entrancePosition: { x: 0, y: 0 },
      exitPosition: { x: 0, y: 0 },
      robberyChance: 1,
      securityLevel: 30,
      policeResponseTime: 3,
      isRobberyInProgress: false,
      isRobberyAlarm: false,
      policeArrivalTime: 0,
      robbers: [],
      guards: [],
      robberyResult: null,
      robberyCheckInterval: null
    };
  },
  computed: {
    availableCounters() {
      return this.bank.counters.filter(c => c.isAvailable && c.isWorking).length;
    },
    regularCounterCount() {
      return this.counterCount - this.vipCounterCount - this.pensionerCounterCount;
    },
    totalClients() {
      return (
        this.bank.clients.length +
        this.bank.vipQueue.length +
        this.bank.pensionerQueue.length +
        this.queuePositions.length +
        this.atmClients.length +
        this.enteringClients.length +
        this.leavingClients.length +
        this.servingClients.length
      );
    },
    atmStyle() {
      return {
        left: this.atmPosition.x + 'px',
        top: this.atmPosition.y + 'px',
        transform: 'translate(-50%, -50%)'
      };
    },
    guardsCount() {
      return Math.floor(this.securityLevel / 20);
    }
  },
  watch: {
    counterCount(newVal) {
      this.vipCounterCount = Math.min(this.vipCounterCount, newVal);
      this.pensionerCounterCount = Math.min(
        this.pensionerCounterCount,
        newVal - this.vipCounterCount
      );
      this.initializeCounters();
    },
    vipCounterCount() {
      this.initializeCounters();
    },
    pensionerCounterCount() {
      this.initializeCounters();
    }
  },
  mounted() {
    this.initializeCounters();
    this.setupBankDimensions();
    window.addEventListener('resize', this.setupBankDimensions);

    this.robberyCheckInterval = setInterval(() => {
      if (this.isRunning && !this.isRobberyInProgress && this.checkRobberyConditions()) {
        this.startRobbery();
      }
    }, 60000);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.setupBankDimensions);
    clearInterval(this.robberyCheckInterval);
  },
  methods: {
    getClientEmoji(client) {
      if (client.type === 'vip') return '🎩';
      if (client.type === 'pensioner') return '👵';
      return '🧍';
    },
    hasSpecialCounters(type) {
      return this.bank.counters.some(c => c.type === type && c.isWorking);
    },
    initializeCounters() {
      this.bank.counters = [];
      let id = 1;
      for (let i = 0; i < this.vipCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 3000 * (100 / this.serviceSpeed), 'vip'));
      }
      for (let i = 0; i < this.pensionerCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 4000 * (100 / this.serviceSpeed), 'pensioner'));
      }
      for (let i = 0; i < this.regularCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 5000 * (100 / this.serviceSpeed), 'regular'));
      }
      this.positionCounters();
      this.initializeGuards();
    },
    positionCounters() {
      if (!this.$refs.bankArea) {
        setTimeout(this.positionCounters, 100);
        return;
      }

      const bankRect = this.$refs.bankArea.getBoundingClientRect();
      const offset = 70;
      const spacing = (bankRect.height - 2 * offset) / Math.max(1, this.counterCount);

      this.bank.counters.forEach((counter, i) => {
        counter.position = {
          x: bankRect.width - offset,
          y: offset + i * spacing
        };
      });

      this.vipQueuePosition = { x: bankRect.width * 0.6, y: bankRect.height * 0.2 };
      this.pensionerQueuePosition = { x: bankRect.width * 0.6, y: bankRect.height * 0.8 };
      this.mainQueuePosition = { x: bankRect.width * 0.6, y: bankRect.height / 2 };
      this.atmPosition = { x: bankRect.width * 0.2, y: bankRect.height * 0.8 };
      this.entrancePosition = { x: 30, y: bankRect.height / 2 };
      this.exitPosition = { x: 30, y: bankRect.height / 2 };
    },
    setupBankDimensions() {
      this.$nextTick(() => {
        this.positionCounters();
      });
    },
    startSimulation() {
      this.resetSimulation();
      this.isRunning = true;
      this.simulationFinished = false;
      this.bank.isWindingDown = false;
      this.atmBroken = false;

      const animate = (timestamp) => {
        if (!this.lastUpdateTime) this.lastUpdateTime = timestamp;
        const deltaTime = timestamp - this.lastUpdateTime;
        this.lastUpdateTime = timestamp;
        this.updateClients(deltaTime);
        if (this.isRunning) {
          this.animationFrame = requestAnimationFrame(animate);
        }
      };

      this.animationFrame = requestAnimationFrame(animate);

      this.intervals.push(setInterval(() => {
        if (this.bank.isWindingDown) return;
        const client = new Client();
        if (Math.random() < this.vipPercentage / 100) client.type = 'vip';
        client.position = { x: this.entrancePosition.x - 40, y: this.entrancePosition.y };
        client.targetPosition = { ...this.entrancePosition };
        this.enteringClients.push(client);
        this.totalEntered++;
        setTimeout(() => {
          this.assignClientToQueue(client);
          this.enteringClients = this.enteringClients.filter(c => c.id !== client.id);
        }, 1000);
      }, this.arrivalRate));

      this.intervals.push(setInterval(() => {
        this.serveQueues();
      }, 100));

      this.intervals.push(setInterval(() => {
        this.checkLeavingClients();
      }, 500));
    },
    assignClientToQueue(client) {
      if (client.type === 'vip') {
        if (this.hasSpecialCounters('vip') || !this.hasSpecialCounters('regular')) {
          this.bank.vipQueue.push(client);
          client.targetPosition = { x: this.vipQueuePosition.x - (this.bank.vipQueue.length - 1) * 30, y: this.vipQueuePosition.y };
        } else {
          this.addToRegularQueue(client);
        }
      } else if (client.type === 'pensioner') {
        if (this.hasSpecialCounters('pensioner') || !this.hasSpecialCounters('regular')) {
          this.bank.pensionerQueue.push(client);
          client.targetPosition = { x: this.pensionerQueuePosition.x - (this.bank.pensionerQueue.length - 1) * 30, y: this.pensionerQueuePosition.y };
        } else {
          this.addToRegularQueue(client);
        }
      } else {
        if (!this.atmBroken && Math.random() < 0.3 &&
          (client.serviceType === 'payment' || client.serviceType === 'deposit')) {
          this.processAtmClient(client);
        } else {
          this.addToRegularQueue(client);
        }
      }
    },
    updateClients(deltaTime) {
      const speedFactor = deltaTime / 16;
      this.enteringClients.forEach(client => this.moveClient(client, speedFactor));
      this.bank.vipQueue.forEach((client, index) => {
        client.targetPosition = { x: this.vipQueuePosition.x - index * 30, y: this.vipQueuePosition.y };
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      this.bank.pensionerQueue.forEach((client, index) => {
        client.targetPosition = { x: this.pensionerQueuePosition.x - index * 30, y: this.pensionerQueuePosition.y };
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      this.queuePositions.forEach((client, index) => {
        client.targetPosition = { x: this.mainQueuePosition.x - index * 30, y: this.mainQueuePosition.y };
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      this.atmClients.forEach(client => this.moveClient(client, speedFactor));
      this.servingClients.forEach(client => this.moveClient(client, speedFactor));
      this.leavingClients.forEach(client => {
        client.leaveProgress = Math.max(0, client.leaveProgress - 0.01 * speedFactor);
        this.moveClient(client, speedFactor);
        if (client.leaveProgress <= 0) {
          this.leavingClients = this.leavingClients.filter(c => c.id !== client.id);
        }
      });

      if (this.isRobberyInProgress) {
        this.moveRobbers(speedFactor);
        this.guardsResponse();
      }
    },
    moveClient(client, speedFactor = 1) {
      const dx = client.targetPosition.x - client.position.x;
      const dy = client.targetPosition.y - client.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 2) {
        const speed = client.speed * speedFactor;
        client.position.x += dx * 0.05 * speed;
        client.position.y += dy * 0.05 * speed;
      } else {
        client.position = { ...client.targetPosition };
      }
    },
    serveQueues() {
      const availableVip = this.bank.counters.find(c => c.type === 'vip' && c.isAvailable && c.isWorking);
      if (availableVip && this.bank.vipQueue.length > 0) {
        const client = this.bank.vipQueue.shift();
        this.serveClient(client, availableVip);
        return;
      }

      const availablePensioner = this.bank.counters.find(c => c.type === 'pensioner' && c.isAvailable && c.isWorking);
      if (availablePensioner && this.bank.pensionerQueue.length > 0) {
        const client = this.bank.pensionerQueue.shift();
        this.serveClient(client, availablePensioner);
        return;
      }

      const availableRegular = this.bank.counters.find(c => c.type === 'regular' && c.isAvailable && c.isWorking);
      if (!this.hasSpecialCounters('vip') && this.bank.vipQueue.length > 0) {
        const client = this.bank.vipQueue.shift();
        this.serveClient(client, availableRegular);
        return;
      }
      if (!this.hasSpecialCounters('pensioner') && this.bank.pensionerQueue.length > 0) {
        const client = this.bank.pensionerQueue.shift();
        this.serveClient(client, availableRegular);
        return;
      }
      if (availableRegular && this.queuePositions.length > 0) {
        const client = this.queuePositions.shift();
        this.serveClient(client, availableRegular);
      }
    },
    async serveClient(client, counter) {
      counter.isAvailable = false;
      counter.currentClient = client;
      client.isServing = true;
      this.servingClients.push(client);
      client.targetPosition = { x: counter.position.x - 30, y: counter.position.y };
      await this.waitForPosition(client);
      await new Promise(resolve => setTimeout(resolve, client.serviceTime * (100 / this.serviceSpeed)));
      client.targetPosition = { ...this.exitPosition };
      await this.waitForPosition(client);
      counter.isAvailable = true;
      counter.currentClient = null;
      this.servingClients = this.servingClients.filter(c => c.id !== client.id);
      this.bank.totalServed++;
      this.makeClientLeave(client);
    },
    processAtmClient(client) {
      client.position = { ...this.entrancePosition };
      client.targetPosition = { ...this.atmPosition };
      this.atmClients.push(client);
      setTimeout(() => {
        this.atmClients = this.atmClients.filter(c => c.id !== client.id);
        this.makeClientLeave(client);
        this.bank.totalServed++;
      }, 3000 * (100 / this.serviceSpeed));
    },
    addToRegularQueue(client) {
      client.position = { ...this.entrancePosition };
      client.targetPosition = {
        x: this.mainQueuePosition.x - this.queuePositions.length * 30,
        y: this.mainQueuePosition.y
      };
      this.queuePositions.push(client);
    },
    async makeClientLeave(client) {
      client.isLeaving = true;
      client.leaveProgress = 1;
      client.targetPosition = { ...this.exitPosition };
      this.leavingClients.push(client);
      this.bank.vipQueue = this.bank.vipQueue.filter(c => c.id !== client.id);
      this.bank.pensionerQueue = this.bank.pensionerQueue.filter(c => c.id !== client.id);
      this.queuePositions = this.queuePositions.filter(c => c.id !== client.id);
      this.atmClients = this.atmClients.filter(c => c.id !== client.id);
      this.servingClients = this.servingClients.filter(c => c.id !== client.id);
      await this.waitForPosition(client);
    },
    checkLeavingClients() {
      this.bank.vipQueue = this.bank.vipQueue.filter(client => {
        if (Math.random() < this.leaveChance / 10000 * (100 - client.patienceLevel)) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });

      this.bank.pensionerQueue = this.bank.pensionerQueue.filter(client => {
        if (Math.random() < this.leaveChance / 8000 * (100 - client.patienceLevel)) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });

      this.queuePositions = this.queuePositions.filter(client => {
        if (Math.random() < this.leaveChance / 5000 * (100 - client.patienceLevel)) {
          this.makeClientLeave(client);
          this.leftClients++;
          return false;
        }
        return true;
      });
    },
    waitForPosition(client) {
      return new Promise(resolve => {
        const check = () => {
          const dx = client.position.x - client.targetPosition.x;
          const dy = client.position.y - client.targetPosition.y;
          if (Math.sqrt(dx * dx + dy * dy) < 5) resolve();
          else setTimeout(check, 50);
        };
        check();
      });
    },
    toggleCounter(counter) {
      if (this.isRunning) {
        counter.isWorking = !counter.isWorking;
        if (!counter.isWorking && counter.currentClient) {
          this.makeClientLeave(counter.currentClient);
          counter.currentClient = null;
          counter.isAvailable = true;
        }
      }
    },
    triggerRandomEvent() {
      const events = [
        { text: "Терминал сломался!", action: () => { this.atmBroken = true; } },
        { text: "Терминал починился!", action: () => { this.atmBroken = false; } },
        { text: "Наплыв клиентов!", action: () => { this.arrivalRate = Math.max(100, this.arrivalRate - 200); } },
        { text: "Сотрудник заболел", action: () => {
          const workingCounters = this.bank.counters.filter(c => c.isWorking);
          if (workingCounters.length > 1) workingCounters[0].isWorking = false;
        }}
      ];
      const event = events[Math.floor(Math.random() * events.length)];
      this.randomEventText = event.text;
      this.randomEventActive = true;
      event.action();
      setTimeout(() => {
        this.randomEventActive = false;
      }, 3000);
    },
    stopSimulation() {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      this.intervals.forEach(clearInterval);
      this.intervals = [];
      this.isRunning = false;
    },
    resetSimulation() {
      this.stopSimulation();
      this.bank = new Bank(50);
      this.bank.totalServed = 0;
      this.totalEntered = 0;
      this.leftClients = 0;
      this.simulationFinished = false;
      this.bank.isWindingDown = false;
      this.queuePositions = [];
      this.atmClients = [];
      this.enteringClients = [];
      this.leavingClients = [];
      this.servingClients = [];
      this.randomEventActive = false;
      this.lastUpdateTime = 0;
      this.isRobberyInProgress = false;
      this.isRobberyAlarm = false;
      this.robbers = [];
      this.guards = [];
      this.robberyResult = null;
      this.initializeCounters();
    },
    initializeGuards() {
      this.guards = [];
      const bankRect = this.$refs.bankArea?.getBoundingClientRect();
      if (!bankRect) return;
      for (let i = 0; i < this.guardsCount; i++) {
        this.guards.push({
          id: i + 1,
          position: {
            x: bankRect.width * 0.3 + i * 40,
            y: bankRect.height * 0.2
          }
        });
      }
    },
    checkRobberyConditions() {
      const angryClients = [...this.bank.vipQueue, ...this.bank.pensionerQueue, ...this.queuePositions]
        .filter(c => c.emotion === 'angry').length;
      const overloadFactor = this.totalClients / this.bank.maxCapacity;
      const securityFactor = 1 - this.securityLevel / 100;
      const robberyProbability = this.robberyChance / 100 *
        (1 + angryClients * 0.1 + overloadFactor * 0.5 + securityFactor * 0.5);
      return Math.random() < robberyProbability;
    },
    startRobbery() {
      if (this.isRobberyInProgress) return;
      this.isRobberyInProgress = true;
      this.isRobberyAlarm = true;
      this.policeArrivalTime = this.policeResponseTime * 60;
      const bankRect = this.$refs.bankArea.getBoundingClientRect();
      const robberCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < robberCount; i++) {
        this.robbers.push({
          id: i + 1,
          position: { x: 20, y: bankRect.height * (0.3 + i * 0.2) },
          targetPosition: { x: bankRect.width * 0.7, y: bankRect.height * 0.5 },
          speed: 1.5,
          status: 'moving',
          counterId: null
        });
      }

      const policeTimer = setInterval(() => {
        this.policeArrivalTime--;
        if (this.policeArrivalTime <= 0) {
          clearInterval(policeTimer);
          this.policeArrive();
        }
      }, 1000);

      setTimeout(() => this.processRobbery(), 2000);
    },
    processRobbery() {
      this.robbers.forEach(robber => {
        const availableCounters = this.bank.counters
          .filter(c => c.isWorking && !this.robbers.some(r => r.counterId === c.id));
        if (availableCounters.length > 0) {
          const targetCounter = availableCounters[Math.floor(Math.random() * availableCounters.length)];
          robber.counterId = targetCounter.id;
          robber.targetPosition = { x: targetCounter.position.x - 40, y: targetCounter.position.y };
        }
      });
      this.panicClients();
      if (this.guards.length > 0) this.guardsResponse();
    },
    panicClients() {
      [...this.bank.vipQueue, ...this.bank.pensionerQueue, ...this.queuePositions].forEach(client => {
        if (Math.random() < 0.3) {
          client.targetPosition = {
            x: this.entrancePosition.x - 100,
            y: client.position.y + (Math.random() * 200 - 100)
          };
          client.speed = 2;
        } else if (Math.random() < 0.2) {
          client.speed = 0.1;
        }
      });
    },
    guardsResponse() {
      this.guards.forEach(guard => {
        if (this.robbers.length > 0) {
          const closestRobber = this.robbers
            .filter(r => ['moving', 'robbing'].includes(r.status))
            .sort((a, b) => {
              const dA = Math.hypot(a.position.x - guard.position.x, a.position.y - guard.position.y);
              const dB = Math.hypot(b.position.x - guard.position.x, b.position.y - guard.position.y);
              return dA - dB;
            })[0];
          if (closestRobber) {
            guard.position.x += (closestRobber.position.x - guard.position.x) * 0.05;
            guard.position.y += (closestRobber.position.y - guard.position.y) * 0.05;
            const distance = Math.hypot(
              closestRobber.position.x - guard.position.x,
              closestRobber.position.y - guard.position.y
            );
            if (distance < 30 && Math.random() < 0.6) {
              this.robbers = this.robbers.filter(r => r.id !== closestRobber.id);
            }
          }
        }
      });
    },
    moveRobbers(speedFactor) {
      this.robbers.forEach(robber => {
        if (['moving', 'robbing'].includes(robber.status)) {
          const dx = robber.targetPosition.x - robber.position.x;
          const dy = robber.targetPosition.y - robber.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 2) {
            robber.position.x += dx * 0.05 * robber.speed * speedFactor;
            robber.position.y += dy * 0.05 * robber.speed * speedFactor;
          } else {
            robber.position = { ...robber.targetPosition };
            if (robber.status === 'moving') robber.status = 'robbing';
          }
        }
        if (robber.status === 'fleeing') {
          robber.position.x -= 2 * speedFactor;
          if (robber.position.x < -50) {
            this.robbers = this.robbers.filter(r => r.id !== robber.id);
          }
        }
      });
    },
    policeArrive() {
      this.robbers.forEach(robber => {
        if (robber.status === 'robbing') {
          if (Math.random() < 0.7) {
            robber.status = 'fleeing';
            robber.targetPosition = { x: -100, y: robber.position.y };
          } else {
            robber.status = 'caught';
          }
        }
      });
      this.calculateRobberyResult();
    },
    calculateRobberyResult() {
      const caught = this.robbers.filter(r => r.status === 'caught').length;
      const total = this.robbers.length;
      const success = caught / total > 0.5;
      const baseLoss = 50000;
      const lossMultiplier = 1 - caught / total;
      const losses = Math.floor(baseLoss * lossMultiplier * total);
      this.bank.totalMoney = Math.max(0, this.bank.totalMoney - losses);
      this.bank.reputation = Math.max(20, this.bank.reputation - (20 * lossMultiplier));
      this.robberyResult = {
        success,
        losses,
        message: success
          ? `Ограбление предотвращено! Задержано ${caught} из ${total} грабителей`
          : `Ограбление завершено! Сбежало ${total - caught} грабителей`
      };
      setTimeout(() => {
        this.isRobberyInProgress = false;
        this.isRobberyAlarm = false;
        this.robbers = [];
        this.robberyResult = null;
        this.bank.counters.forEach(c => {
          if (!c.isWorking) c.isWorking = true;
        });
      }, 5000);
    },
    triggerRobbery() {
      this.startRobbery();
    }
  }
};
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.bank-simulation {
  font-family: Arial, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.controls {
  margin: 10px 0;
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
}

.slider-group {
  margin-bottom: 0;
}

.slider-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  font-size: 14px;
}

.slider-group input {
  width: 100%;
}

.button-group {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 10px;
}

button {
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

button:hover {
  background: #45a049;
}

button:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px 0;
  padding: 10px;
  background: #e8f5e9;
  border-radius: 8px;
  font-size: 14px;
}

.simulation-winding {
  color: #FF9800;
  font-weight: bold;
}

.simulation-finished {
  color: #4CAF50;
  font-weight: bold;
}

.random-event {
  color: #2196F3;
  font-weight: bold;
  animation: blink 1s infinite;
}

.robbery-alert {
  color: #F44336;
  font-weight: bold;
  animation: blink 0.5s infinite;
}

.robbery-result {
  padding: 5px;
  border-radius: 4px;
  margin-top: 5px;
  text-align: center;
}

.robbery-result.success {
  background-color: #E8F5E9;
  color: #4CAF50;
}

.robbery-result.failure {
  background-color: #FFEBEE;
  color: #F44336;
}

@keyframes blink {
  50% { opacity: 0.5; }
}

.bank-visualization {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 500px;
  background-color: #f9f9f9;
  border: 3px solid #333;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 15px rgba(0,0,0,0.1);
}

.robbery-alert-bg {
  animation: robberyAlert 1s infinite;
}

@keyframes robberyAlert {
  0% { background-color: #f9f9f9; }
  50% { background-color: #ffcccc; }
  100% { background-color: #f9f9f9; }
}

.bank-walls {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: #f9f9f9;
  border: 2px solid #333;
}

.entrance-door {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 30px;
  z-index: 1;
}

.atm {
  position: absolute;
  left: 20%;
  top: 80%;
  font-size: 40px;
  z-index: 1;
}

.service-window {
  position: absolute;
  width: 60px;
  height: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  z-index: 2;
  transition: all 0.3s ease;
  cursor: pointer;
  border-radius: 5px;
  box-shadow: 0 0 5px rgba(0,0,0,0.2);
  background-color: #4CAF50;
}

.vip-counter {
  border: 2px solid gold;
  background-color: #FFF9C4 !important;
}

.pensioner-counter {
  border: 2px solid #FF9800;
  background-color: #FFE0B2 !important;
}

.counter-closed {
  background-color: #9E9E9E !important;
}

.counter-type {
  font-size: 10px;
  margin-top: 5px;
  text-transform: capitalize;
}

.client {
  position: absolute;
  width: 30px;
  height: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.5s ease;
  z-index: 3;
}

.vip-client {
  z-index: 4;
}

.pensioner-client {
  z-index: 4;
}

.client-emoji {
  font-size: 24px;
  display: inline-block;
  animation: walk 0.5s infinite alternate;
}

@keyframes walk {
  from { transform: translateY(0); }
  to { transform: translateY(-3px); }
}

.serving-client .client-emoji {
  animation: serve 1s infinite;
}

@keyframes serve {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.client-status {
  font-size: 10px;
  margin-top: 2px;
  white-space: nowrap;
  text-transform: capitalize;
}

.emotion-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 2px;
}

.emotion-indicator.neutral {
  background-color: #4CAF50;
}

.emotion-indicator.annoyed {
  background-color: #FFC107;
}

.emotion-indicator.angry {
  background-color: #F44336;
}

.entering-client {
  z-index: 5;
  opacity: 0.8;
}

.leaving-client {
  z-index: 5;
  opacity: 0.6;
}

.client-move {
  transition: all 0.5s ease;
}

.client-enter-active {
  transition: all 0.5s ease;
  animation: enter 0.5s;
}

.client-leave-active {
  transition: all 0.5s ease;
  animation: leave 0.5s reverse;
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes leave {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
}

.robber {
  position: absolute;
  width: 40px;
  height: 40px;
  z-index: 10;
  transition: all 0.3s ease;
}

.robber-emoji {
  font-size: 30px;
  display: block;
  text-align: center;
}

.guard {
  position: absolute;
  width: 35px;
  height: 35px;
  z-index: 9;
  transition: all 0.3s ease;
}

.guard-emoji {
  font-size: 25px;
  display: block;
  text-align: center;
}

@media (max-width: 768px) {
  .bank-simulation {
    padding: 10px;
    height: auto;
  }
  
  .controls {
    grid-template-columns: 1fr;
  }
  
  .bank-visualization {
    min-height: 400px;
  }
}
</style>