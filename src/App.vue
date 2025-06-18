<template>
  <div class="bank-simulation">
    <!-- Заголовок симуляции -->
    <h1>Имитация очереди в банке</h1>
    
    <!-- Панель управления параметрами -->
    <div class="controls">
      <!-- Регулировка количества окон -->
      <div class="slider-group">
        <label>Количество окон: {{ counterCount }}</label>
        <input type="range" min="1" max="10" v-model.number="counterCount" :disabled="isRunning">
      </div>
      
      <!-- Регулировка скорости обработки -->
      <div class="slider-group">
        <label>Скорость обработки: {{ processSpeed }} мс</label>
        <input type="range" min="1000" max="10000" step="100" v-model.number="processSpeed" :disabled="isRunning">
      </div>
      
      <!-- Регулировка скорости прихода клиентов -->
      <div class="slider-group">
        <label>Скорость прихода: {{ arrivalRate }} мс</label>
        <input type="range" min="100" max="2000" step="50" v-model.number="arrivalRate" :disabled="isRunning">
      </div>
      
      <!-- Регулировка максимального количества клиентов -->
      <div class="slider-group">
        <label>Макс. клиентов: {{ maxCustomers }}</label>
        <input type="range" min="5" max="50" v-model.number="maxCustomers" :disabled="isRunning">
      </div>
      
      <!-- Кнопки управления симуляцией -->
      <div class="button-group">
        <button @click="startSimulation" :disabled="isRunning">Старт</button>
        <button @click="stopSimulation" :disabled="!isRunning">Стоп</button>
        <button @click="resetSimulation">Сброс</button>
      </div>
    </div>
    
    <!-- Панель статистики -->
    <div class="stats">
      <div>Клиентов в банке: {{ bank.clients.length }}</div>
      <div>Свободных окон: {{ availableCounters }}</div>
      <div>Обслужено: {{ servedClients }} / {{ maxCustomers }}</div>
      <div v-if="simulationFinished" class="simulation-finished">Симуляция окончена!</div>
    </div>
    
    <!-- Визуализация банка -->
    <div class="bank-visualization" ref="bankArea">
      <div class="bank-walls">
        <!-- Входная дверь -->
        <div class="entrance-door"></div>
        
        <!-- Окна обслуживания -->
        <div 
          v-for="counter in bank.counters" 
          :key="counter.id"
          class="service-window"
          :style="{
            left: counter.position.x + 'px',
            top: counter.position.y + 'px',
            backgroundColor: counter.isAvailable ? '#4CAF50' : '#F44336'
          }"
        >
          <!-- Иконка кассира или часов -->
          <span v-if="counter.currentClient">⏱️</span>
          <span v-else>👔</span>
        </div>
        
        <!-- Клиенты в банке -->
        <div 
          v-for="client in bank.clients" 
          :key="client.id"
          class="client"
          :class="{ 'client-leaving': client.isLeaving }"
          :style="{
            left: client.position.x + 'px',
            top: client.position.y + 'px'
          }"
        >
          <span class="client-emoji">🧍</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// Класс, описывающий банк
export class Bank {
  constructor(maxCapacity) {
    this.maxCapacity = maxCapacity; // Максимальная вместимость
    this.clients = []; // Массив клиентов
    this.counters = []; // Массив окон
  }
}

// Класс, описывающий окно обслуживания
export class Counter {
  constructor(id, processTime) {
    this.id = id; // ID окна
    this.processTime = processTime; // Время обработки
    this.currentClient = null; // Текущий клиент
    this.isAvailable = true; // Свободно ли окно
    this.position = { x: 0, y: 0 }; // Позиция на экране
  }
}

// Класс, описывающий клиента
export class Client {
  static nextId = 1; // Счетчик для генерации ID
  
  constructor() {
    this.id = Client.nextId++; // Уникальный ID
    this.position = { x: 0, y: 0 }; // Текущая позиция
    this.targetPosition = null; // Целевая позиция
    this.targetCounter = null; // Целевое окно
    this.speed = 0.5 + Math.random(); // Скорость движения
    this.isWaiting = false; // Ожидает ли у окна
    this.patience = 5000 + Math.random() * 10000; // Время до ухода без обслуживания
    this.enteredTime = Date.now(); // Время входа
    this.isLeaving = false; // Уходит ли клиент
  }
}

export default {
  data() {
    return {
      bank: new Bank(50), // Экземпляр банка
      counterCount: 3, // Количество окон
      processSpeed: 3000, // Скорость обработки (мс)
      arrivalRate: 500, // Скорость прихода клиентов (мс)
      maxCustomers: 20, // Максимальное число клиентов
      servedClients: 0, // Число обслуженных клиентов
      totalEntered: 0, // Всего вошло клиентов
      isRunning: false, // Идет ли симуляция
      simulationFinished: false, // Завершена ли симуляция
      intervals: [] // Массив интервалов
    };
  },
  
  computed: {
    // Количество свободных окон
    availableCounters() {
      return this.bank.counters.filter(c => c.isAvailable).length;
    }
  },
  
  watch: {
    // При изменении количества окон
    counterCount(newVal) {
      this.initializeCounters(newVal);
    },
    // При изменении скорости обработки
    processSpeed(newVal) {
      this.bank.counters.forEach(c => c.processTime = newVal);
    }
  },
  
  mounted() {
    // Инициализация при загрузке компонента
    this.initializeCounters();
    this.setupBankDimensions();
    window.addEventListener('resize', this.setupBankDimensions);
  },
  
  beforeUnmount() {
    // Очистка при размонтировании компонента
    this.stopSimulation();
    window.removeEventListener('resize', this.setupBankDimensions);
  },
  
  methods: {
    // Инициализация окон
    initializeCounters(count = this.counterCount) {
      this.bank.counters = Array.from({ length: count }, (_, i) => {
        return new Counter(i + 1, this.processSpeed);
      });
      this.positionCounters();
    },
    
    // Позиционирование окон
    positionCounters() {
      if (!this.$refs.bankArea) return;
      
      const bankRect = this.$refs.bankArea.getBoundingClientRect();
      const offset = 70;
      
      this.bank.counters.forEach((counter, i) => {
        counter.position = {
          x: bankRect.width - offset,
          y: offset + i * (bankRect.height - 2 * offset) / this.counterCount
        };
      });
    },
    
    // Обновление размеров банка
    setupBankDimensions() {
      this.$nextTick(this.positionCounters);
    },
    
    // Запуск симуляции
    startSimulation() {
      this.resetSimulation();
      this.isRunning = true;
      
      // Интервал для добавления новых клиентов
      this.intervals.push(setInterval(() => {
        if (this.totalEntered >= this.maxCustomers) return;
        
        const client = new Client();
        client.position = { 
          x: 50, 
          y: this.$refs.bankArea.clientHeight / 2 
        };
        client.targetPosition = this.getRandomPosition();
        
        this.bank.clients.push(client);
        this.totalEntered++;
      }, this.arrivalRate));
      
      // Основной цикл анимации и логики
      this.intervals.push(setInterval(() => {
        const now = Date.now();
        
        this.bank.clients.forEach(client => {
          // Клиент может уйти без обслуживания
          if (!client.isWaiting && !client.targetCounter && 
              now - client.enteredTime > client.patience && 
              Math.random() < 0.005) {
            this.makeClientLeave(client);
            return;
          }
          
          // Обработка уходящих клиентов
          if (client.isLeaving) {
            this.handleLeavingClient(client);
            return;
          }
          
          // Назначение случайной цели, если нет текущей
          if (!client.targetPosition) {
            client.targetPosition = this.getRandomPosition();
          }
          
          // Движение к цели
          const dx = client.targetPosition.x - client.position.x;
          const dy = client.targetPosition.y - client.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 2) {
            client.position.x += (dx / distance) * client.speed;
            client.position.y += (dy / distance) * client.speed;
          } else {
            // Достигли цели
            if (client.targetCounter) {
              const counter = this.bank.counters.find(c => c.id === client.targetCounter);
              if (counter && counter.isAvailable) {
                this.serveClient(client, counter);
              } else {
                // Окно занято - идем гулять
                client.targetPosition = this.getRandomPosition();
                client.targetCounter = null;
                client.isWaiting = false;
              }
            } else {
              // Просто гуляем
              client.targetPosition = this.getRandomPosition();
              
              // Пытаемся найти свободное окно
              if (Math.random() < 0.05 && !client.isWaiting) {
                this.tryAssignToCounter(client);
              }
            }
          }
        });
        
        // Назначение клиентов к свободным окнам (по одному на окно)
        if (this.availableCounters > 0) {
          const freeCounters = this.bank.counters.filter(c => c.isAvailable);
          freeCounters.forEach(counter => {
            const oldestClient = this.bank.clients
              .filter(c => !c.isWaiting && !c.targetCounter && !c.isLeaving)
              .sort((a, b) => a.id - b.id)[0]; // Берем самого "старого" клиента
            
            if (oldestClient) {
              oldestClient.targetCounter = counter.id;
              oldestClient.targetPosition = {
                x: counter.position.x - 30,
                y: counter.position.y
              };
              oldestClient.isWaiting = true;
            }
          });
        }
      }, 16));
    },
    
    // Попытка назначить клиента к окну
    tryAssignToCounter(client) {
      const freeCounter = this.bank.counters.find(c => c.isAvailable);
      if (freeCounter) {
        client.targetCounter = freeCounter.id;
        client.targetPosition = {
          x: freeCounter.position.x - 30,
          y: freeCounter.position.y
        };
        client.isWaiting = true;
      }
    },
    
    // Клиент решает уйти
    makeClientLeave(client) {
      client.isLeaving = true;
      client.targetPosition = {
        x: 30,
        y: this.$refs.bankArea.clientHeight / 2
      };
    },
    
    // Обработка ухода клиента
    handleLeavingClient(client) {
      const dx = client.targetPosition.x - client.position.x;
      const dy = client.targetPosition.y - client.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 2) {
        client.position.x += (dx / distance) * client.speed * 1.5;
        client.position.y += (dy / distance) * client.speed * 1.5;
      } else {
        // Клиент вышел
        this.bank.clients = this.bank.clients.filter(c => c.id !== client.id);
      }
    },
    
    // Обслуживание клиента
    async serveClient(client, counter) {
      client.isWaiting = false;
      counter.isAvailable = false;
      counter.currentClient = client;
      
      // Имитация времени обслуживания
      await new Promise(resolve => setTimeout(resolve, counter.processTime));
      
      // Клиент уходит после обслуживания
      client.isLeaving = true;
      client.targetPosition = {
        x: 30,
        y: this.$refs.bankArea.clientHeight / 2
      };
      
      // Ждем пока клиент дойдет до выхода
      await new Promise(resolve => {
        const checkExit = setInterval(() => {
          if (!client.targetPosition || 
              Math.abs(client.position.x - 30) < 5) {
            clearInterval(checkExit);
            resolve();
          }
        }, 100);
      });
      
      // Удаляем клиента и обновляем счетчики
      this.bank.clients = this.bank.clients.filter(c => c.id !== client.id);
      counter.isAvailable = true;
      counter.currentClient = null;
      this.servedClients++;
      
      // Проверка завершения симуляции
      if (this.servedClients >= this.maxCustomers) {
        this.finishSimulation();
      }
    },
    
    // Остановка симуляции
    stopSimulation() {
      this.intervals.forEach(clearInterval);
      this.intervals = [];
      this.isRunning = false;
    },
    
    // Завершение симуляции
    finishSimulation() {
      this.stopSimulation();
      this.simulationFinished = true;
    },
    
    // Сброс симуляции
    resetSimulation() {
      this.stopSimulation();
      this.bank = new Bank(50);
      this.servedClients = 0;
      this.totalEntered = 0;
      this.simulationFinished = false;
      this.initializeCounters();
    },
    
    // Генерация случайной позиции в банке
    getRandomPosition() {
      return {
        x: 100 + Math.random() * (this.$refs.bankArea.clientWidth - 200),
        y: 50 + Math.random() * (this.$refs.bankArea.clientHeight - 100)
      };
    }
  }
};
</script>

<style scoped>
/* Основные стили */
.bank-simulation {
  font-family: Arial, sans-serif;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

/* Стили панели управления */
.controls {
  margin: 20px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.slider-group {
  margin-bottom: 15px;
}

.slider-group label {
  display: block;
  margin-bottom: 5px;
}

.slider-group input {
  width: 100%;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

button {
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #cccccc;
}

/* Стили панели статистики */
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin: 20px 0;
  padding: 10px;
  background: #e8f5e9;
  border-radius: 8px;
}

.simulation-finished {
  color: #f44336;
  font-weight: bold;
}

/* Стили визуализации банка */
.bank-visualization {
  position: relative;
  width: 100%;
  height: 500px;
  background-color: #f5f5f5;
  border: 4px solid #333;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 15px rgba(0,0,0,0.2);
}

.bank-walls {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #f9f9f9;
}

/* Стили входной двери */
.entrance-door {
  position: absolute;
  width: 40px;
  height: 80px;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  background-color: #8D6E63;
  border: 2px solid #5D4037;
}

/* Стили окон обслуживания */
.service-window {
  position: absolute;
  width: 50px;
  height: 80px;
  background-color: #4CAF50;
  border: 2px solid #2E7D32;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  z-index: 2;
}

/* Стили клиентов */
.client {
  position: absolute;
  width: 30px;
  height: 30px;
  transform: translate(-50%, -50%);
  transition: left 0.3s ease-out, top 0.3s ease-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

.client-emoji {
  font-size: 24px;
  margin-bottom: 2px;
  filter: drop-shadow(0 0 2px rgba(0,0,0,0.3));
}

/* Стили для уходящих клиентов */
.client-leaving {
  opacity: 0.7;
  transform: translate(-50%, -50%) scale(0.9);
  transition: all 0.5s ease-out;
}
</style>