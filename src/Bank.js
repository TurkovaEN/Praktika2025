// Bank.js

// Класс, представляющий банк в симуляции
export class Bank {
  constructor(maxCapacity) {
    this.maxCapacity = maxCapacity;       // Максимальное количество клиентов, которое может находиться в банке
    this.clients = [];                    // Массив всех клиентов, находящихся в банке
    this.counters = [];                   // Массив всех окон обслуживания в банке
    this.totalServed = 0;                 // Счетчик общего количества обслуженных клиентов
    this.isWindingDown = false;           // Флаг, указывающий на завершение работы банка
    this.vipQueue = [];                   // Очередь VIP-клиентов
    this.pensionerQueue = [];             // Очередь клиентов-пенсионеров
    this.reputation = 100;                // Уровень репутации банка (0-100)
    this.lastVipArrivalTime = 0;          // Время последнего прихода VIP-клиента
  }
}

// Класс, представляющий окно обслуживания в банке
export class Counter {
  constructor(id, processTime, type = 'regular') {
    this.id = id;                         // Уникальный идентификатор окна
    this.processTime = processTime;       // Базовое время обработки клиента (в мс)
    this.currentClient = null;            // Текущий обслуживаемый клиент (null если окно свободно)
    this.isAvailable = true;              // Доступно ли окно для обслуживания
    this.position = { x: 0, y: 0 };       // Позиция окна на визуальной карте банка
    this.type = type;                     // Тип окна: 'regular', 'vip' или 'pensioner'
    this.isWorking = true;                // Работает ли окно (можно отключить)
  }
}

// Базовый класс клиента банка
export class Client {
  static nextId = 1;                      // Статический счетчик для генерации уникальных ID клиентов
  
  constructor() {
    this.id = Client.nextId++;            // Уникальный идентификатор клиента
    this.position = { x: 0, y: 0 };       // Текущая позиция клиента в банке
    this.targetPosition = null;           // Целевая позиция для перемещения
    this.speed = 0.5 + Math.random();     // Скорость перемещения клиента (0.5-1.5)
    this.isWaiting = false;               // Ожидает ли клиент в очереди
    this.patience = 20000 + Math.random() * 30000; // Время терпения (20-50 секунд)
    this.enteredTime = Date.now();        // Время входа клиента в банк
    this.isLeaving = false;               // Флаг ухода клиента
    this.served = false;                  // Был ли клиент обслужен
    this.serviceType = this.getRandomService(); // Тип запрашиваемой услуги
    this.serviceTime = this.calculateServiceTime(); // Расчетное время обслуживания
    this.type = this.determineClientType(); // Тип клиента ('regular' или 'pensioner')
    this.emotion = 'neutral';             // Текущее эмоциональное состояние
    this.patienceLevel = 100;             // Уровень терпения в процентах (100% - полное терпение)
    this.isPanicking = false;             // В панике ли клиент (при ограблении)
  }

  // Возвращает случайный тип банковской услуги
  getRandomService() {
    const services = ['deposit', 'credit', 'payment', 'consultation'];
    return services[Math.floor(Math.random() * services.length)];
  }

  // Рассчитывает время обслуживания в зависимости от типа услуги
  calculateServiceTime() {
    switch(this.serviceType) {
      case 'credit': return 8000 + Math.random() * 5000;      // 8-13 секунд
      case 'deposit': return 5000 + Math.random() * 3000;     // 5-8 секунд
      case 'consultation': return 6000 + Math.random() * 4000; // 6-10 секунд
      default: return 2000 + Math.random() * 2000;            // payment: 2-4 секунды
    }
  }

  // Определяет тип клиента (30% шанс быть пенсионером)
  determineClientType() {
    const rand = Math.random();
    if (rand < 0.3) return 'pensioner';
    return 'regular';
  }

  // Обновляет эмоциональное состояние на основе времени ожидания
  updateEmotion() {
    const waitTime = Date.now() - this.enteredTime;
    this.patienceLevel = Math.max(0, 100 - (waitTime / this.patience) * 100);
    
    // Определение эмоции по уровню терпения
    if (this.patienceLevel < 20) this.emotion = 'angry';
    else if (this.patienceLevel < 50) this.emotion = 'annoyed';
    else this.emotion = 'neutral';
  }

  // Сбрасывает счетчик ID (используется при перезапуске симуляции)
  static resetIdCounter() {
    if (Client.nextId > 1000) {  // Сбрасываем только после большого количества клиентов
      Client.nextId = 1;
    }
  }
}

// Класс VIP-клиента (наследуется от Client)
export class VipClient extends Client {
  constructor() {
    super();
    this.type = 'vip';                    // Установка типа клиента как VIP
    this.patience = 30000 + Math.random() * 20000; // VIP более терпеливы (30-50 сек)
    this.serviceTime = this.calculateServiceTime() * 0.8; // Обслуживание на 20% быстрее
  }

  // Возвращает случайный тип услуги для VIP (другие варианты услуг)
  getRandomService() {
    const services = ['credit', 'consultation', 'investment'];
    return services[Math.floor(Math.random() * services.length)];
  }

  // Сбрасывает счетчик ID (аналогично базовому классу Client)
  static resetIdCounter() {
    if (Client.nextId > 1000) {
      Client.nextId = 1;
    }
  }
}