<template>
  <!-- Основной контейнер приложения -->
  <div class="bank-simulation">
    <!-- Заголовок симуляции -->
    <h1>Банковская симуляция</h1>

    <!-- Панель управления параметрами симуляции -->
    <div class="controls">
      <!-- Левая колонка с основными настройками -->
      <div class="left-column">
        <!-- Слайдер количества окон -->
        <div class="slider-group">
          <label>Окон всего: {{ counterCount }}</label>
          <input type="range" min="1" max="10" v-model.number="counterCount" :disabled="isRunning">
        </div>
        
        <!-- Слайдер VIP окон -->
        <div class="slider-group">
          <label>VIP окон: {{ vipCounterCount }}</label>
          <input type="range" min="0" :max="counterCount" v-model.number="vipCounterCount" :disabled="isRunning">
        </div>
        
        <!-- Слайдер окон для пенсионеров -->
        <div class="slider-group">
          <label>Окон для пенсионеров: {{ pensionerCounterCount }}</label>
          <input type="range" min="0" :max="counterCount - vipCounterCount" v-model.number="pensionerCounterCount"
            :disabled="isRunning">
        </div>
        
        <!-- Слайдер скорости обслуживания -->
        <div class="slider-group">
          <label>Скорость обслуживания: {{ serviceSpeed }}%</label>
          <input type="range" min="50" max="200" v-model.number="serviceSpeed" :disabled="isRunning">
        </div>
        
        <!-- Слайдер частоты появления клиентов -->
        <div class="slider-group">
          <label>Частота появления: {{ arrivalFrequency }} сек</label>
          <input type="range" min="0.1" max="5" step="0.1" v-model.number="arrivalFrequency" :disabled="isRunning || isRobberyInProgress">
        </div>
        
        <!-- Слайдер вероятности ухода клиентов -->
        <div class="slider-group">
          <label>Вероятность ухода: {{ leaveChance }}%</label>
          <input type="range" min="0" max="50" v-model.number="leaveChance" :disabled="isRunning">
        </div>
        
        <!-- Слайдер скорости реакции полиции -->
        <div class="slider-group">
          <label>Скорость полиции: {{ policeResponseTime }} сек</label>
          <input type="range" min="10" max="60" v-model.number="policeResponseTime" :disabled="isRunning">
        </div>
      </div>
      
      <!-- Правая колонка с настройками безопасности -->
      <div class="right-column">
        <!-- Слайдер вероятности ограбления -->
        <div class="slider-group">
          <label>Шанс ограбления: {{ robberyChance }}%</label>
          <input type="range" min="0" max="10" v-model.number="robberyChance" :disabled="isRunning">
        </div>
        
        <!-- Слайдер уровня охраны -->
        <div class="slider-group">
          <label>Охрана: {{ securityLevel }}</label>
          <input type="range" min="0" max="5" v-model.number="securityLevel" :disabled="isRunning">
        </div>
      </div>

      <!-- Группа кнопок управления -->
      <div class="button-group">
        <button @click="startSimulation" :disabled="isRunning">Старт</button>
        <button @click="stopSimulation" :disabled="!isRunning">Стоп</button>
        <button @click="resetSimulation">Сброс</button>
        <button @click="triggerRobbery" :disabled="!isRunning || isRobberyInProgress">Начать ограбление</button>
      </div>
    </div>

    <!-- Блок статистики -->
    <div class="stats">
      <div>Клиентов: {{ totalClients }}</div>
      <div>Обслужено: {{ bank.totalServed }}</div>
      <div>Свободных окон: {{ availableCounters }}</div>
      <div>Ушло клиентов: {{ leftClients }}</div>

      <!-- Сообщения о состоянии системы -->
      <div v-if="bank.isWindingDown" class="simulation-winding">Завершение работы...</div>
      <div v-if="simulationFinished" class="simulation-finished">Симуляция завершена!</div>
      <div v-if="isRobberyInProgress" class="robbery-alert">
        ⚠️ ОГРАБЛЕНИЕ! Полиция прибудет через {{ policeArrivalTime }} сек
      </div>
      <div v-if="robberyResult" :class="['robbery-result', robberyResult.success ? 'success' : 'failure']">
        {{ robberyResult.message }}
      </div>
    </div>

    <!-- Визуализация банка с анимацией -->
    <div class="bank-visualization" ref="bankArea" :class="{ 'robbery-alert-bg': isRobberyAlarm }">
      <div class="bank-layout">
        <!-- Основная зона банка -->
        <div class="bank-area">
          <!-- Элементы интерьера банка -->
          <div class="entrance-door">🚪</div>
          <div class="atm" :style="atmStyle">🏧</div>

          <!-- Окна обслуживания -->
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

          <!-- Анимированные клиенты (вход, обслуживание, выход) -->
          <transition-group name="client" tag="div">
            <!-- Входящие клиенты -->
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

            <!-- Клиенты у банкомата -->
            <div v-for="client in atmClients" :key="'atm-' + client.id" class="client atm-client"
              :style="{
                left: client.position.x + 'px',
                top: client.position.y + 'px',
                transform: 'translate(-50%, -50%)',
                transition: `all ${client.speed * 0.5}s ease-out`
              }">
              <span class="client-emoji">💳</span>
            </div>

            <!-- Обслуживаемые клиенты -->
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

          <!-- Грабители -->
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

          <!-- Охранники -->
          <div v-for="guard in guards" :key="'guard-' + guard.id" class="guard"
            :style="{
              left: guard.position.x + 'px',
              top: guard.position.y + 'px',
              transform: 'translate(-50%, -50%)'
            }">
            <span class="guard-emoji">🛡️</span>
          </div>
        </div>

        <!-- Зона очередей -->
        <div class="queue-area">
          <!-- VIP очередь -->
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

          <!-- Очередь пенсионеров -->
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

          <!-- Основная очередь -->
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

          <!-- Уходящие клиенты -->
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
// Импорт классов и стилей
import { Bank, Counter, Client, VipClient } from './Bank.js';
import './BankSimulation.css';

export default {
  data() {
    return {
      // Основные данные симуляции
      bank: new Bank(50), // Экземпляр банка с максимальной вместимостью
      counterCount: 5,     // Общее количество окон
      vipCounterCount: 1,  // Количество VIP окон
      pensionerCounterCount: 1, // Количество окон для пенсионеров
      serviceSpeed: 100,   // Скорость обслуживания (%)
      arrivalFrequency: 1, // Частота появления клиентов (сек)
      leaveChance: 10,     // Вероятность ухода клиента (%)
      isRunning: false,    // Флаг работы симуляции
      simulationFinished: false, // Флаг завершения симуляции
      intervals: [],       // Массив интервалов
      animationFrame: null, // ID анимационного кадра
      lastUpdateTime: 0,   // Время последнего обновления
      totalEntered: 0,     // Всего вошло клиентов
      leftClients: 0,      // Клиентов ушло
      
      // Данные для визуализации
      queuePositions: [],  // Позиции в очереди
      atmClients: [],      // Клиенты у банкомата
      enteringClients: [], // Входящие клиенты
      leavingClients: [],  // Уходящие клиенты
      servingClients: [],  // Обслуживаемые клиенты
      atmBroken: false,    // Флаг сломанного банкомата
      
      // Позиции элементов
      vipQueuePosition: { x: 0, y: 0 }, // Позиция VIP очереди
      pensionerQueuePosition: { x: 0, y: 0 }, // Позиция очереди пенсионеров
      mainQueuePosition: { x: 0, y: 0 }, // Позиция основной очереди
      atmPosition: { x: 0, y: 0 }, // Позиция банкомата
      entrancePosition: { x: 0, y: 0 }, // Позиция входа
      exitPosition: { x: 0, y: 0 }, // Позиция выхода
      
      // Данные для механики ограбления
      isRobberyInProgress: false, // Флаг ограбления
      isRobberyAlarm: false,      // Флаг тревоги
      robbers: [],               // Массив грабителей
      guards: [],                // Массив охранников
      policeArrivalTime: 0,      // Время прибытия полиции
      policeResponseTime: 30,    // Время реакции полиции (сек)
      robberyChance: 1,          // Шанс ограбления (%)
      securityLevel: 2,          // Уровень охраны
      originalArrivalRate: 1     // Исходная частота появления клиентов
    };
  },
  computed: {
    // Количество свободных окон
    availableCounters() {
      return this.bank.counters.filter(c => c.isAvailable && c.isWorking).length;
    },
    // Количество обычных окон
    regularCounterCount() {
      return this.counterCount - this.vipCounterCount - this.pensionerCounterCount;
    },
    // Общее количество клиентов в банке
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
    // Стили для банкомата
    atmStyle() {
      return {
        left: this.atmPosition.x + 'px',
        top: this.atmPosition.y + 'px',
        transform: 'translate(-50%, -50%)'
      };
    }
  },
  watch: {
    // Наблюдатель за изменением общего количества окон
    counterCount(newVal) {
      this.vipCounterCount = Math.min(this.vipCounterCount, newVal);
      this.pensionerCounterCount = Math.min(
        this.pensionerCounterCount,
        newVal - this.vipCounterCount
      );
      this.initializeCounters();
    },
    // Наблюдатель за изменением количества VIP окон
    vipCounterCount() {
      this.initializeCounters();
    },
    // Наблюдатель за изменением количества окон для пенсионеров
    pensionerCounterCount() {
      this.initializeCounters();
    },
    // Наблюдатель за изменением уровня охраны
    securityLevel() {
      this.initializeGuards();
    }
  },
  mounted() {
    // Инициализация при монтировании компонента
    this.initializeCounters();
    this.setupBankDimensions();
    window.addEventListener('resize', this.setupBankDimensions);
  },
  beforeUnmount() {
    // Очистка при демонтировании компонента
    window.removeEventListener('resize', this.setupBankDimensions);
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.intervals.forEach(clearInterval);
  },
  methods: {
    // Получение emoji для клиента по его типу
    getClientEmoji(client) {
      if (client.type === 'vip') return '🎩';
      if (client.type === 'pensioner') return '👵';
      return '🧍';
    },
    
    // Проверка наличия окон определенного типа
    hasSpecialCounters(type) {
      return this.bank.counters.some(c => c.type === type && c.isWorking);
    },
    
    // Инициализация окон обслуживания
    initializeCounters() {
      this.bank.counters = [];
      let id = 1;
      
      // Создание VIP окон
      for (let i = 0; i < this.vipCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 3000 * (100 / this.serviceSpeed), 'vip'));
      }
      
      // Создание окон для пенсионеров
      for (let i = 0; i < this.pensionerCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 4000 * (100 / this.serviceSpeed), 'pensioner'));
      }
      
      // Создание обычных окон
      for (let i = 0; i < this.regularCounterCount; i++) {
        this.bank.counters.push(new Counter(id++, 5000 * (100 / this.serviceSpeed), 'regular'));
      }
      
      this.positionCounters(); // Позиционирование окон
      this.initializeGuards(); // Инициализация охраны
    },
    
    // Позиционирование элементов банка
    positionCounters() {
      if (!this.$refs.bankArea) {
        setTimeout(this.positionCounters, 100);
        return;
      }
      
      const bankRect = this.$refs.bankArea.getBoundingClientRect();
      const offset = 70;
      const spacing = (bankRect.height - 2 * offset) / Math.max(1, this.counterCount);

      // Позиционирование окон
      this.bank.counters.forEach((counter, i) => {
        counter.position = {
          x: bankRect.width - offset,
          y: offset + i * spacing
        };
      });

      // Установка позиций для очередей и других элементов
      this.vipQueuePosition = { x: bankRect.width * 0.6, y: bankRect.height * 0.2 };
      this.pensionerQueuePosition = { x: bankRect.width * 0.6, y: bankRect.height * 0.8 };
      this.mainQueuePosition = { x: bankRect.width * 0.6, y: bankRect.height / 2 };
      this.atmPosition = { x: bankRect.width * 0.2, y: bankRect.height * 0.8 };
      this.entrancePosition = { x: 30, y: bankRect.height / 2 };
      this.exitPosition = { x: 30, y: bankRect.height / 2 };
    },
    
    // Установка размеров банка при изменении окна
    setupBankDimensions() {
      this.$nextTick(() => {
        this.positionCounters();
      });
    },
    
    // Запуск симуляции
    startSimulation() {
      this.resetSimulation();
      this.isRunning = true;
      this.simulationFinished = false;
      this.bank.isWindingDown = false;
      this.atmBroken = false;

      // Анимация движения клиентов
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

      // Интервал появления новых клиентов
      const clientInterval = setInterval(() => {
        if (this.bank.isWindingDown || this.isRobberyInProgress) return;
        if (this.totalClients >= this.bank.maxCapacity) return;

        // Логика появления VIP клиентов
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

        // Логика появления обычных клиентов
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
      }, this.arrivalFrequency * 1000);

      this.intervals.push(clientInterval);
      this.intervals.push(setInterval(() => this.serveQueues(), 100));
      this.intervals.push(setInterval(() => this.checkLeavingClients(), 500));
    },
    
    // Обслуживание VIP клиента
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
    
    // Распределение клиентов по очередям
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
    
    // Обновление позиций клиентов
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
    
    // Движение клиента к целевой позиции
    moveClient(client, speedFactor = 1) {
      const bankRect = this.$refs.bankArea?.getBoundingClientRect();
      if (!bankRect) return;

      // Паника при ограблении
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
    
    // Обслуживание очередей
    serveQueues() {
      if (this.isRobberyInProgress) return;

      // Обслуживание пенсионеров
      const availablePensioner = this.bank.counters.find(c => c.type === 'pensioner' && c.isAvailable && c.isWorking);
      if (availablePensioner && this.bank.pensionerQueue.length > 0) {
        const client = this.bank.pensionerQueue.shift();
        this.serveClient(client, availablePensioner);
        return;
      }

      // Обслуживание обычных клиентов
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
    
    // Процесс обслуживания клиента
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
    
    // Обработка клиента у банкомата
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
    
    // Добавление клиента в обычную очередь
    addToRegularQueue(client) {
      client.position = { ...this.entrancePosition };
      client.targetPosition = {
        x: this.mainQueuePosition.x - this.queuePositions.length * 30,
        y: this.mainQueuePosition.y
      };
      this.queuePositions.push(client);
    },
    
    // Процесс ухода клиента
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
    
    // Проверка уходящих клиентов
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
    
    // Ожидание достижения клиентом целевой позиции
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
    
    // Переключение состояния окна (работает/не работает)
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
    
    // Остановка симуляции
    stopSimulation() {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      this.intervals.forEach(clearInterval);
      this.intervals = [];
      this.isRunning = false;
    },
    
    // Сброс симуляции
    resetSimulation() {
      this.stopSimulation();
      this.bank = new Bank(50);
      Client.resetIdCounter();
      VipClient.resetIdCounter();
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
      this.lastUpdateTime = 0;
      this.isRobberyInProgress = false;
      this.isRobberyAlarm = false;
      this.robbers = [];
      this.guards = [];
      this.robberyResult = null;
      this.initializeCounters();
    },
    
    // Инициализация охранников
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
          },
          targetPosition: {
            x: bankRect.width * 0.3 + i * 40,
            y: bankRect.height * 0.2
          }
        });
      }
    },
    
    // Запуск ограбления
    triggerRobbery() {
      if (!this.isRunning || this.isRobberyInProgress) return;
      
      this.isRobberyInProgress = true;
      this.isRobberyAlarm = true;
      this.policeArrivalTime = this.policeResponseTime;
      
      const bankRect = this.$refs.bankArea.getBoundingClientRect();
      this.robbers = [{
        id: 1,
        position: { x: 50, y: bankRect.height / 2 },
        targetPosition: { x: bankRect.width * 0.7, y: bankRect.height * 0.5 },
        speed: 1.5,
        status: 'moving',
        counterId: null
      }];
      
      this.sendClientsToPanic();
      
      setTimeout(() => {
        this.robbers.forEach(robber => {
          const availableCounters = this.bank.counters.filter(c => c.isWorking);
          if (availableCounters.length > 0) {
            const targetCounter = availableCounters[Math.floor(Math.random() * availableCounters.length)];
            robber.counterId = targetCounter.id;
            robber.targetPosition = { x: targetCounter.position.x - 40, y: targetCounter.position.y };
          }
        });
      }, 1000);
      
      const policeTimer = setInterval(() => {
        this.policeArrivalTime--;
        if (this.policeArrivalTime <= 0) {
          clearInterval(policeTimer);
          this.policeArrive();
        }
      }, 1000);
    },
    
    // Паника клиентов при ограблении
    sendClientsToPanic() {
      const bankRect = this.$refs.bankArea.getBoundingClientRect();
      if (!bankRect) return;

      const allClients = [
        ...this.bank.pensionerQueue,
        ...this.queuePositions,
        ...this.atmClients,
        ...this.servingClients
      ];
      
      allClients.forEach(client => {
        client.isPanicking = true;
        client.speed = 2 + Math.random();
        client.targetPosition = {
          x: Math.random() * (bankRect.width - 100) + 50,
          y: Math.random() * (bankRect.height - 100) + 50
        };
      });
    },
    
    // Движение грабителей
    moveRobbers(speedFactor) {
      this.robbers.forEach(robber => {
        if (['moving', 'robbing'].includes(robber.status)) {
          const dx = robber.targetPosition.x - robber.position.x;
          const dy = robber.targetPosition.y - robber.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
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
    
    // Реакция охраны на ограбление
    guardsResponse() {
      this.guards.forEach(guard => {
        const activeRobbers = this.robbers.filter(r => ['moving', 'robbing'].includes(r.status));
        if (activeRobbers.length > 0) {
          const closestRobber = activeRobbers.reduce((closest, robber) => {
            const dist = Math.hypot(
              robber.position.x - guard.position.x,
              robber.position.y - guard.position.y
            );
            return dist < closest.dist ? { robber, dist } : closest;
          }, { robber: null, dist: Infinity }).robber;
          
          if (closestRobber) {
            guard.targetPosition = {
              x: closestRobber.position.x,
              y: closestRobber.position.y
            };
            
            const dx = guard.targetPosition.x - guard.position.x;
            const dy = guard.targetPosition.y - guard.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 30 && Math.random() < 0.6) {
              closestRobber.status = 'caught';
            }
          }
        } else {
          // Возвращение охранников на места
          const bankRect = this.$refs.bankArea.getBoundingClientRect();
          guard.targetPosition = {
            x: bankRect.width * 0.3 + (guard.id - 1) * 40,
            y: bankRect.height * 0.2
          };
        }
        
        // Движение охранника
        const dx = guard.targetPosition.x - guard.position.x;
        const dy = guard.targetPosition.y - guard.position.y;
        guard.position.x += dx * 0.05;
        guard.position.y += dy * 0.05;
      });
    },
    
    // Прибытие полиции
    policeArrive() {
      this.robbers.forEach(robber => {
        if (robber.status === 'robbing') {
          robber.status = Math.random() < 0.7 ? 'fleeing' : 'caught';
          if (robber.status === 'fleeing') {
            robber.targetPosition = { x: -100, y: robber.position.y };
          }
        }
      });
      
      this.calculateRobberyResult();
      this.arrivalFrequency = this.originalArrivalRate;
      
      // Успокоение клиентов
      const allClients = [
        ...this.bank.pensionerQueue,
        ...this.queuePositions,
        ...this.atmClients,
        ...this.servingClients
      ];
      allClients.forEach(client => {
        client.isPanicking = false;
        client.speed = 0.5 + Math.random();
      });
    },
    
    // Расчет результата ограбления
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
      }, 5000);
    }
  }
};
</script>