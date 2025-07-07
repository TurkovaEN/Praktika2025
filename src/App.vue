<template>
  <div class="bank-simulation">
    <h1>Банковская симуляция</h1>

   <div class="controls">
  <div class="left-column">
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
      <label>Частота появления: {{ arrivalFrequency }} сек</label>
      <input type="range" min="0.1" max="5" step="0.1" v-model.number="arrivalFrequency" :disabled="isRunning || isRobberyInProgress">
    </div>
    <div class="slider-group">
      <label>Вероятность ухода: {{ leaveChance }}%</label>
      <input type="range" min="0" max="50" v-model.number="leaveChance" :disabled="isRunning">
    </div>
    <div class="slider-group">
      <label>Скорость полиции: {{ policeResponseTime }} сек</label>
      <input type="range" min="10" max="60" v-model.number="policeResponseTime" :disabled="isRunning">
    </div>
  </div>
  
  <div class="right-column">
    <div class="slider-group">
      <label>Шанс ограбления: {{ robberyChance }}%</label>
      <input type="range" min="0" max="10" v-model.number="robberyChance" :disabled="isRunning">
    </div>
    <div class="slider-group">
      <label>Охрана: {{ securityLevel }}</label>
      <input type="range" min="0" max="5" v-model.number="securityLevel" :disabled="isRunning">
    </div>
  </div>

  <div class="button-group">
    <button @click="startSimulation" :disabled="isRunning">Старт</button>
    <button @click="stopSimulation" :disabled="!isRunning">Стоп</button>
    <button @click="resetSimulation">Сброс</button>
    <button @click="triggerRobbery" :disabled="!isRunning || isRobberyInProgress">Начать ограбление</button>
  </div>
</div>

    <div class="stats">
      <div>Клиентов: {{ totalClients }}</div>
      <div>Обслужено: {{ bank.totalServed }}</div>
      <div>Свободных окон: {{ availableCounters }}</div>
      <div>Ушло клиентов: {{ leftClients }}</div>

      <div v-if="bank.isWindingDown" class="simulation-winding">Завершение работы...</div>
      <div v-if="simulationFinished" class="simulation-finished">Симуляция завершена!</div>
      <div v-if="isRobberyInProgress" class="robbery-alert">
        ⚠️ ОГРАБЛЕНИЕ! Полиция прибудет через {{ policeArrivalTime }} сек
      </div>
      <div v-if="robberyResult" :class="['robbery-result', robberyResult.success ? 'success' : 'failure']">
        {{ robberyResult.message }}
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
import { Bank, Counter, Client, VipClient } from './Bank.js';
import './BankSimulation.css';

export default {
  data() {
    return {
      bank: new Bank(50),
      counterCount: 5,
      vipCounterCount: 1,
      pensionerCounterCount: 1,
      serviceSpeed: 100,
      arrivalFrequency: 1,
      leaveChance: 10,
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
      vipQueuePosition: { x: 0, y: 0 },
      pensionerQueuePosition: { x: 0, y: 0 },
      mainQueuePosition: { x: 0, y: 0 },
      atmPosition: { x: 0, y: 0 },
      entrancePosition: { x: 0, y: 0 },
      exitPosition: { x: 0, y: 0 },
      robberyChance: 1,
      securityLevel: 2,
      policeResponseTime: 30,
      isRobberyInProgress: false,
      isRobberyAlarm: false,
      policeArrivalTime: 0,
      robbers: [],
      guards: [],
      robberyResult: null,
      originalArrivalRate: 1
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
    },
    securityLevel() {
      this.initializeGuards();
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
    if (this.vipInterval) clearInterval(this.vipInterval);
    Client.resetIdCounter();
    VipClient.resetIdCounter();
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
      if (this.isRunning) return;
      
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

      let lastClientTime = 0;
      const clientInterval = setInterval(() => {
        if (this.bank.isWindingDown || this.isRobberyInProgress) return;
        
        if (this.totalClients >= this.bank.maxCapacity) return;

        const now = Date.now();
        if (now - lastClientTime < this.arrivalFrequency * 1000) return;
        lastClientTime = now;

        const availableVipCounters = this.bank.counters.filter(c => 
          c.type === 'vip' && c.isAvailable && c.isWorking
        );
        
        if (availableVipCounters.length > 0 && Math.random() < 0.1) {
          const client = new Client();
          client.type = 'vip';
          client.position = { x: this.entrancePosition.x - 40, y: this.entrancePosition.y };
          client.targetPosition = { ...this.entrancePosition };
          this.enteringClients.push(client);
          this.totalEntered++;
          
          setTimeout(() => {
            this.enteringClients = this.enteringClients.filter(c => c.id !== client.id);
            const counter = availableVipCounters[0];
            this.serveVipClient(client, counter);
          }, 1000);
          return;
        }

        const client = new Client();
        if (Math.random() < 0.3) client.type = 'pensioner';
        else client.type = 'regular';
        
        client.position = { x: this.entrancePosition.x - 40, y: this.entrancePosition.y };
        client.targetPosition = { ...this.entrancePosition };
        this.enteringClients.push(client);
        this.totalEntered++;
        
        setTimeout(() => {
          this.assignClientToQueue(client);
          this.enteringClients = this.enteringClients.filter(c => c.id !== client.id);
        }, 1000);
      }, 100);

      this.intervals.push(clientInterval);

      this.intervals.push(setInterval(() => {
        this.serveQueues();
      }, 100));

      this.intervals.push(setInterval(() => {
        this.checkLeavingClients();
      }, 500));
    },
    serveVipClient(client, counter) {
      counter.isAvailable = false;
      counter.currentClient = client;
      client.isServing = true;
      this.servingClients.push(client);
      client.targetPosition = { x: counter.position.x - 30, y: counter.position.y };
      
      this.waitForPosition(client).then(() => {
        return new Promise(resolve => setTimeout(resolve, client.serviceTime * (100 / this.serviceSpeed)));
      }).then(() => {
        client.targetPosition = { ...this.exitPosition };
        return this.waitForPosition(client);
      }).then(() => {
        counter.isAvailable = true;
        counter.currentClient = null;
        this.servingClients = this.servingClients.filter(c => c.id !== client.id);
        this.bank.totalServed++;
        this.makeClientLeave(client);
      });
    },
    assignClientToQueue(client) {
      if (client.type === 'pensioner') {
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
      this.bank.pensionerQueue.forEach((client, index) => {
        if (!this.isRobberyInProgress || client.isPanicking) {
          client.targetPosition = { x: this.pensionerQueuePosition.x - index * 30, y: this.pensionerQueuePosition.y };
        }
        this.moveClient(client, speedFactor);
        client.updateEmotion();
      });
      this.queuePositions.forEach((client, index) => {
        if (!this.isRobberyInProgress || client.isPanicking) {
          client.targetPosition = { x: this.mainQueuePosition.x - index * 30, y: this.mainQueuePosition.y };
        }
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
      const bankRect = this.$refs.bankArea?.getBoundingClientRect();
      if (!bankRect) return;

      if (this.isRobberyInProgress && !client.isPanicking) {
        client.isPanicking = true;
        client.targetPosition = {
          x: Math.random() * (bankRect.width - 50) + 25,
          y: Math.random() * (bankRect.height - 50) + 25
        };
        client.speed = 2 + Math.random();
      }

      const dx = client.targetPosition.x - client.position.x;
      const dy = client.targetPosition.y - client.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 2) {
        const speed = client.speed * speedFactor;
        client.position.x += dx * 0.05 * speed;
        client.position.y += dy * 0.05 * speed;
        
        client.position.x = Math.max(10, Math.min(bankRect.width - 10, client.position.x));
        client.position.y = Math.max(10, Math.min(bankRect.height - 10, client.position.y));
      } else if (this.isRobberyInProgress && client.isPanicking) {
        client.targetPosition = {
          x: Math.random() * (bankRect.width - 50) + 25,
          y: Math.random() * (bankRect.height - 50) + 25
        };
      } else {
        client.position = { ...client.targetPosition };
      }
    },
    serveQueues() {
      if (this.isRobberyInProgress) return;

      const availablePensioner = this.bank.counters.find(c => c.type === 'pensioner' && c.isAvailable && c.isWorking);
      if (availablePensioner && this.bank.pensionerQueue.length > 0) {
        const client = this.bank.pensionerQueue.shift();
        this.serveClient(client, availablePensioner);
        return;
      }

      const availableRegular = this.bank.counters.find(c => c.type === 'regular' && c.isAvailable && c.isWorking);
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
    stopSimulation() {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      this.intervals.forEach(clearInterval);
      this.intervals = [];
      if (this.vipInterval) clearInterval(this.vipInterval);
      this.vipInterval = null;
      this.isRunning = false;
    },
    resetSimulation() {
            this.stopSimulation();
      
      // Полностью сбрасываем все состояния
      this.bank = new Bank(50);
      Client.resetIdCounter();
      VipClient.resetIdCounter();
      
      // Очищаем все массивы клиентов
      this.enteringClients = [];
      this.leavingClients = [];
      this.servingClients = [];
      this.atmClients = [];
      this.queuePositions = [];
      this.bank.vipQueue = [];
      this.bank.pensionerQueue = [];
      
      // Сбрасываем всю статистику
      this.bank.totalServed = 0;
      this.totalEntered = 0;
      this.leftClients = 0;
      
      // Сбрасываем состояние симуляции
      this.simulationFinished = false;
      this.bank.isWindingDown = false;
      
      // Сбрасываем состояние ограбления
      this.isRobberyInProgress = false;
      this.isRobberyAlarm = false;
      this.robbers = [];
      this.guards = [];
      this.robberyResult = null;
      this.policeArrivalTime = 0;
      this.arrivalFrequency = this.originalArrivalRate;
      
      // Переинициализируем кассы и охранников
      this.initializeCounters();
      this.initializeGuards();
      
      // Обновляем позиции элементов
      this.$nextTick(() => {
        this.positionCounters();
      });
    },
    initializeGuards() {
      this.guards = [];
      const bankRect = this.$refs.bankArea?.getBoundingClientRect();
      if (!bankRect) return;
      for (let i = 0; i < this.securityLevel; i++) {
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
      const angryClients = [...this.bank.pensionerQueue, ...this.queuePositions]
        .filter(c => c.emotion === 'angry').length;
      const overloadFactor = this.totalClients / this.bank.maxCapacity;
      const securityFactor = 1 - this.securityLevel / 5;
      const robberyProbability = this.robberyChance / 100 *
        (1 + angryClients * 0.1 + overloadFactor * 0.5 + securityFactor * 0.5);
      return Math.random() < robberyProbability;
    },
    startRobbery() {
      if (this.isRobberyInProgress) return;
      this.isRobberyInProgress = true;
      this.isRobberyAlarm = true;
      this.policeArrivalTime = this.policeResponseTime;
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

      this.originalArrivalRate = this.arrivalFrequency;
      this.arrivalFrequency = 0;

      [...this.bank.pensionerQueue, ...this.queuePositions, ...this.atmClients, ...this.servingClients].forEach(client => {
        client.isPanicking = true;
        client.targetPosition = {
          x: Math.random() * (bankRect.width - 50) + 25, 
          y: Math.random() * (bankRect.height - 50) + 25
        };
        client.speed = 2 + Math.random();
      });

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
      
      this.arrivalFrequency = this.originalArrivalRate;
      [...this.bank.pensionerQueue, ...this.queuePositions, ...this.atmClients, ...this.servingClients].forEach(client => {
        client.isPanicking = false;
        client.speed = 0.5 + Math.random();
      });
    },
    calculateRobberyResult() {
      const caught = this.robbers.filter(r => r.status === 'caught').length;
      const total = this.robbers.length;
      const success = caught / total > 0.5;
      
      this.robberyResult = {
        success,
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