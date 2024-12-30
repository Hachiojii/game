class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;

    const stats = {
      スライム: { hp: 10, attack: 3, char: "s", color: "#ff4444" },
      コウモリ: { hp: 8, attack: 4, char: "b", color: "#ff4444" },
      オーク: { hp: 15, attack: 5, char: "o", color: "#ff4444" },
    };

    this.hp = stats[type].hp;
    this.maxHp = stats[type].hp;
    this.attack = stats[type].attack;
    this.char = stats[type].char;
    this.color = stats[type].color;
  }
}

class Item {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;

    const stats = {
      ポーション: {
        char: "p",
        color: "#44ff44",
        effect: "heal",
        value: 15, // 回復量を増加
      },
      経験値の結晶: {
        char: "e",
        color: "#ffff44",
        effect: "exp",
        value: 5, // 基本経験値
      },
    };

    this.char = stats[type].char;
    this.color = stats[type].color;
    this.effect = stats[type].effect;
    this.value = stats[type].value;
  }
}

class Game {
  constructor() {
    this.mapSize = 15;
    this.currentFloor = 1;
    this.maps = [];
    this.enemies = [];
    this.items = [];
    this.startPositions = [];
    this.discoveredTiles = new Set();
    this.visibilityRadius = 1.5;
    this.gameOver = false;
    this.player = {
      x: 0,
      y: 0,
      level: 1,
      exp: 0,
      hp: 20,
      maxHp: 20,
      attack: 5,
      nextExp: 10,
    };
    this.generateMaps();
    this.currentMap = this.maps[0];
    this.player.x = this.startPositions[0].x;
    this.player.y = this.startPositions[0].y;
    this.updateDisplay();
  }

  generateMaps() {
    for (let floor = 0; floor < 5; floor++) {
      let map, startX, startY, goalX, goalY;

      // マップの生成
      map = this.generateConnectedMap();

      // スタート地点の設定
      do {
        startX = Math.floor(Math.random() * (this.mapSize - 2)) + 1;
        startY = Math.floor(Math.random() * (this.mapSize - 2)) + 1;
      } while (map[startY][startX] === "#");

      map[startY][startX] = ".";

      // ゴール地点の設定
      do {
        goalX = Math.floor(Math.random() * (this.mapSize - 2)) + 1;
        goalY = Math.floor(Math.random() * (this.mapSize - 2)) + 1;
      } while (
        map[goalY][goalX] === "#" ||
        (goalX === startX && goalY === startY)
      );

      map[goalY][goalX] = ">";
      this.maps.push(map);
      this.startPositions.push({ x: startX, y: startY });

      // 敵とアイテムの配置
      this.generateEntities(floor, map, startX, startY, goalX, goalY);
    }
  }

  // 完全に接続されたマップを生成
  generateConnectedMap() {
    let map = [];

    // 最初は全て床で初期化
    for (let y = 0; y < this.mapSize; y++) {
      let row = [];
      for (let x = 0; x < this.mapSize; x++) {
        if (
          x === 0 ||
          x === this.mapSize - 1 ||
          y === 0 ||
          y === this.mapSize - 1
        ) {
          row.push("#"); // 外周は壁
        } else {
          row.push("."); // 内側は全て床
        }
      }
      map.push(row);
    }

    // ランダムに壁を配置していく
    for (let y = 1; y < this.mapSize - 1; y++) {
      for (let x = 1; x < this.mapSize - 1; x++) {
        if (Math.random() < 0.3) {
          // 30%の確率で壁を配置
          // 仮に壁を置いてみる
          map[y][x] = "#";

          // その壁によって分断されるかチェック
          if (!this.isMapConnected(map)) {
            // 分断される場合は床に戻す
            map[y][x] = ".";
          }
        }
      }
    }

    return map;
  }

  // マップが完全に接続されているかチェック
  isMapConnected(map) {
    // 最初の床のマスを見つける
    let startX = -1,
      startY = -1;
    for (let y = 1; y < this.mapSize - 1; y++) {
      for (let x = 1; x < this.mapSize - 1; x++) {
        if (map[y][x] === ".") {
          startX = x;
          startY = y;
          break;
        }
      }
      if (startX !== -1) break;
    }

    // 床のマスの総数を数える
    let totalFloors = 0;
    for (let y = 1; y < this.mapSize - 1; y++) {
      for (let x = 1; x < this.mapSize - 1; x++) {
        if (map[y][x] === ".") totalFloors++;
      }
    }

    // 到達可能なマスを数える
    const visited = new Set();
    const queue = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const current = queue.shift();
      const key = `${current.x},${current.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      // 隣接するマスをチェック
      const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dx, dy] of directions) {
        const newX = current.x + dx;
        const newY = current.y + dy;

        if (
          newX >= 0 &&
          newX < this.mapSize &&
          newY >= 0 &&
          newY < this.mapSize &&
          map[newY][newX] === "."
        ) {
          queue.push({ x: newX, y: newY });
        }
      }
    }

    // 到達可能なマスの数が床の総数と一致すれば完全に接続されている
    return visited.size === totalFloors;
  }

  // 敵とアイテムの配置
  generateEntities(floor, map, startX, startY, goalX, goalY) {
    const floorEnemies = [];
    const floorItems = [];
    const availableTiles = [];

    // 利用可能なタイルのリストを作成
    for (let y = 1; y < this.mapSize - 1; y++) {
      for (let x = 1; x < this.mapSize - 1; x++) {
        if (
          map[y][x] === "." &&
          (x !== startX || y !== startY) &&
          (x !== goalX || y !== goalY)
        ) {
          availableTiles.push({ x, y });
        }
      }
    }

    // 配置位置をシャッフル
    for (let i = availableTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableTiles[i], availableTiles[j]] = [
        availableTiles[j],
        availableTiles[i],
      ];
    }

    // 敵の配置
    const enemyTypes = ["スライム", "コウモリ", "オーク"];
    for (let i = 0; i < 5 && availableTiles.length > 0; i++) {
      const pos = availableTiles.pop();
      const enemyType =
        enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      floorEnemies.push(new Enemy(pos.x, pos.y, enemyType));
    }

    // ポーションの配置
    for (let i = 0; i < 2 && availableTiles.length > 0; i++) {
      const pos = availableTiles.pop();
      floorItems.push(new Item(pos.x, pos.y, "ポーション"));
    }

    // 経験値の結晶の配置（70%の確率）
    if (Math.random() < 0.7 && availableTiles.length > 0) {
      const pos = availableTiles.pop();
      floorItems.push(new Item(pos.x, pos.y, "経験値の結晶"));
    }

    this.enemies.push(floorEnemies);
    this.items.push(floorItems);
  }

  isVisible(x, y) {
    const dx = Math.abs(x - this.player.x);
    const dy = Math.abs(y - this.player.y);
    return dx <= this.visibilityRadius && dy <= this.visibilityRadius;
  }

  updateDisplay() {
    const mapDiv = document.getElementById("game-map");
    const minimapDiv = document.getElementById("minimap");
    mapDiv.innerHTML = "";
    minimapDiv.innerHTML = "";

    // カメラの表示範囲を設定
    const viewRange = 6; // プレイヤーの位置から上下左右に6マス
    const table = document.createElement("table");

    // プレイヤーを中心とした表示範囲の計算
    const startY = this.player.y - viewRange;
    const endY = this.player.y + viewRange;
    const startX = this.player.x - viewRange;
    const endX = this.player.x + viewRange;

    // 表示範囲のマップを描画
    for (let y = startY; y <= endY; y++) {
      const tr = document.createElement("tr");
      for (let x = startX; x <= endX; x++) {
        const td = document.createElement("td");
        td.className = "tile";

        // マップ範囲外の場合
        if (x < 0 || x >= this.mapSize || y < 0 || y >= this.mapSize) {
          td.textContent = " ";
          td.classList.add("out-of-bounds");
          tr.appendChild(td);
          continue;
        }

        const isVisible = this.isVisible(x, y);
        const tileKey = `${x},${y},${this.currentFloor}`;

        if (isVisible) {
          this.discoveredTiles.add(tileKey);
        }

        // 未探索の場合は完全な暗闇
        if (!isVisible && !this.discoveredTiles.has(tileKey)) {
          td.textContent = " ";
          td.classList.add("hidden");
          tr.appendChild(td);
          continue;
        }

        // 探索済みだが現在見えない場合は薄暗く
        if (!isVisible) {
          td.textContent = this.currentMap[y][x];
          td.classList.add("fog");
          tr.appendChild(td);
          continue;
        }

        // 現在見えている場合
        let content = this.currentMap[y][x];
        let color = "#fff";

        // アイテムの描画
        const item = this.items[this.currentFloor - 1].find(
          (item) => item.x === x && item.y === y
        );
        if (item) {
          content = item.char;
          color = item.color;
        }

        // 敵の描画
        const enemy = this.enemies[this.currentFloor - 1].find(
          (enemy) => enemy.x === x && enemy.y === y
        );
        if (enemy) {
          content = enemy.char;
          color = enemy.color;
        }

        // プレイヤーの描画
        if (x === this.player.x && y === this.player.y) {
          content = "@";
          color = "#fff";
        }

        td.textContent = content;
        td.style.color = color;
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    mapDiv.appendChild(table);

    // ミニマップの描画（探索済みの部分のみ表示）
    const minimapTable = document.createElement("table");
    for (let y = 0; y < this.mapSize; y++) {
      const tr = document.createElement("tr");
      for (let x = 0; x < this.mapSize; x++) {
        const td = document.createElement("td");
        const tileKey = `${x},${y},${this.currentFloor}`;

        if (this.discoveredTiles.has(tileKey)) {
          td.textContent = this.currentMap[y][x];
          if (x === this.player.x && y === this.player.y) {
            td.style.color = "#ff0";
          }
        } else {
          td.textContent = " ";
          td.classList.add("hidden");
        }
        tr.appendChild(td);
      }
      minimapTable.appendChild(tr);
    }
    minimapDiv.appendChild(minimapTable);

    // ステータス表示の更新
    document.getElementById("level").textContent = this.player.level;
    document.getElementById("exp").textContent = this.player.exp;
    document.getElementById("next-exp").textContent = this.player.nextExp;
    document.getElementById("hp").textContent = this.player.hp;
    document.getElementById("maxhp").textContent = this.player.maxHp;
    document.getElementById("attack").textContent = this.player.attack;
    document.getElementById("floor").textContent = this.currentFloor;

    // HPゲージの更新
    const hpGauge = document.getElementById("hp-gauge");
    const hpPercentage = (this.player.hp / this.player.maxHp) * 100;
    hpGauge.style.width = `${hpPercentage}%`;

    // 経験値ゲージの更新
    const expGauge = document.getElementById("exp-gauge");
    const expPercentage = (this.player.exp / this.player.nextExp) * 100;
    expGauge.style.width = `${expPercentage}%`;

    // ゲームオーバー表示
    if (this.gameOver) {
      const gameOverContainer = document.createElement("div");
      gameOverContainer.className = "game-over-container";

      const gameOverDiv = document.createElement("div");
      gameOverDiv.className = "game-over-text";
      gameOverDiv.textContent = "GAME OVER";

      const retryButton = document.createElement("button");
      retryButton.className = "retry-button";
      retryButton.textContent = "RETRY";
      retryButton.onclick = () => this.resetGame();

      gameOverContainer.appendChild(gameOverDiv);
      gameOverContainer.appendChild(retryButton);
      mapDiv.appendChild(gameOverContainer);
    } else if (this.gameClear) {
      this.showGameClear();
    }
  }

  addMessage(message) {
    const messageLog = document.getElementById("message-log");
    messageLog.innerHTML = message + "<br>" + messageLog.innerHTML;

    // 最新のメッセージが見えるように自動スクロール
    messageLog.scrollTop = 0;
  }

  combat(enemy) {
    if (this.gameOver) return;

    // プレイヤーの攻撃
    enemy.hp -= this.player.attack;
    this.addMessage(
      `プレイヤーの攻撃！ ${this.player.attack}のダメージを与えた！`
    );

    if (enemy.hp <= 0) {
      // 敵を倒した時の経験値獲得
      const exp = this.getEnemyExp(enemy);
      this.addExp(exp);

      const index = this.enemies[this.currentFloor - 1].indexOf(enemy);
      this.enemies[this.currentFloor - 1].splice(index, 1);
      this.addMessage(`${enemy.type}を倒した！`);
      return;
    }

    // 敵の反撃
    this.enemyAttack(enemy);
  }

  // 経験値の追加とレベルアップの処理
  addExp(exp) {
    this.player.exp += exp;
    this.addMessage(`${exp}の経験値を獲得！`);

    while (this.player.exp >= this.player.nextExp) {
      this.levelUp();
    }
    this.updateDisplay();
  }

  // レベルアップの処理
  levelUp() {
    this.player.level++;
    this.player.exp -= this.player.nextExp;

    const hpIncrease = Math.floor(this.player.maxHp * 0.2) + 5;
    const attackIncrease = Math.floor(this.player.attack * 0.15) + 2;

    this.player.maxHp += hpIncrease;
    this.player.hp = this.player.maxHp; // 全回復
    this.player.attack += attackIncrease;
    this.player.nextExp = Math.floor(this.player.nextExp * 1.5);

    this.addMessage(`レベルアップ！ Lv.${this.player.level}になった！`);
    this.addMessage(
      `最大HPが${hpIncrease}、攻撃力が${attackIncrease}上昇した！`
    );
  }

  // 敵の経験値を取得
  getEnemyExp(enemy) {
    const expTable = {
      スライム: 3,
      コウモリ: 4,
      オーク: 8,
    };
    return Math.floor(expTable[enemy.type] * (this.currentFloor * 1.2));
  }

  moveEnemies() {
    if (this.gameOver) return;

    this.enemies[this.currentFloor - 1].forEach((enemy) => {
      // プレイヤーとの距離を計算
      const dx = Math.abs(enemy.x - this.player.x);
      const dy = Math.abs(enemy.y - this.player.y);
      const distance = Math.max(dx, dy); // チェビシェフ距離を使用

      // プレイヤーが隣接している場合は攻撃
      if (this.isAdjacent(enemy.x, enemy.y, this.player.x, this.player.y)) {
        this.enemyAttack(enemy);
        return;
      }

      // 3マス以内にプレイヤーがいる場合は追跡
      if (distance <= 3) {
        this.moveEnemyTowardsPlayer(enemy);
      } else {
        // それ以外はランダム移動
        this.moveEnemyRandomly(enemy);
      }
    });
  }

  // プレイヤーを追跡する移動
  moveEnemyTowardsPlayer(enemy) {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;

    // 移動方向の候補を作成（プレイヤーに近づく方向を優先）
    let moves = [];

    // 横方向の移動
    if (dx > 0) moves.push({ x: 1, y: 0 });
    if (dx < 0) moves.push({ x: -1, y: 0 });

    // 縦方向の移動
    if (dy > 0) moves.push({ x: 0, y: 1 });
    if (dy < 0) moves.push({ x: 0, y: -1 });

    // 移動候補をシャッフル（同じ距離の場合はランダムに選択）
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }

    // 移動可能な方向に移動
    for (const move of moves) {
      const newX = enemy.x + move.x;
      const newY = enemy.y + move.y;

      if (this.canEnemyMoveTo(newX, newY)) {
        enemy.x = newX;
        enemy.y = newY;
        break;
      }
    }
  }

  // ランダムな方向に移動
  moveEnemyRandomly(enemy) {
    const moves = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];

    // 移動方向をシャッフル
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }

    // 移動可能な方向があれば移動
    for (const move of moves) {
      const newX = enemy.x + move.x;
      const newY = enemy.y + move.y;

      if (this.canEnemyMoveTo(newX, newY)) {
        enemy.x = newX;
        enemy.y = newY;
        break;
      }
    }
  }

  // 敵が指定の位置に移動可能かチェック
  canEnemyMoveTo(x, y) {
    // マップ範囲内かチェック
    if (x < 0 || x >= this.mapSize || y < 0 || y >= this.mapSize) {
      return false;
    }

    // 壁でないかチェック
    if (this.currentMap[y][x] === "#") {
      return false;
    }

    // 他の敵がいないかチェック
    if (
      this.enemies[this.currentFloor - 1].some((e) => e.x === x && e.y === y)
    ) {
      return false;
    }

    // プレイヤーの位置でないかチェック
    if (this.player.x === x && this.player.y === y) {
      return false;
    }

    return true;
  }

  // 移動先の妥当性チェック
  isValidMove(x, y) {
    if (x < 0 || x >= this.mapSize || y < 0 || y >= this.mapSize) {
      return false;
    }

    if (this.currentMap[y][x] === "#") {
      return false;
    }

    const enemyExists = this.enemies[this.currentFloor - 1].some(
      (e) => e.x === x && e.y === y
    );
    if (enemyExists) {
      return false;
    }

    if (x === this.player.x && y === this.player.y) {
      return false;
    }

    return true;
  }

  movePlayer(direction) {
    // ゲームオーバーまたはクリア時は操作を受け付けない
    if (this.gameOver || this.gameClear) {
      return;
    }

    let newX = this.player.x;
    let newY = this.player.y;

    if (direction === "Wait") {
      this.addMessage("その場で様子を伺った...");
      this.moveEnemies();
      this.updateDisplay();
      return;
    }

    switch (direction) {
      case "ArrowUp":
        newY--;
        break;
      case "ArrowDown":
        newY++;
        break;
      case "ArrowLeft":
        newX--;
        break;
      case "ArrowRight":
        newX++;
        break;
    }

    // 移動先の判定
    if (this.currentMap[newY][newX] === "#") return;

    // 敵との戦闘判定
    const enemy = this.enemies[this.currentFloor - 1].find(
      (e) => e.x === newX && e.y === newY
    );
    if (enemy) {
      this.combat(enemy);
      return;
    }

    // アイテムの取得判定
    const item = this.items[this.currentFloor - 1].find(
      (i) => i.x === newX && i.y === newY
    );
    if (item) {
      const itemIndex = this.items[this.currentFloor - 1].indexOf(item);
      this.items[this.currentFloor - 1].splice(itemIndex, 1);
      this.useItem(item);
    }

    this.player.x = newX;
    this.player.y = newY;

    // 階段判定
    if (this.currentMap[newY][newX] === ">") {
      if (this.currentFloor < 5) {
        this.currentFloor++;
        this.currentMap = this.maps[this.currentFloor - 1];
        this.player.x = this.startPositions[this.currentFloor - 1].x;
        this.player.y = this.startPositions[this.currentFloor - 1].y;
        this.addMessage(`${this.currentFloor}階に降りた！`);
      } else {
        this.gameClear = true;
        this.addMessage("ゲームクリア！おめでとう！");
        this.showGameClear();
        this.updateDisplay();
        return;
      }
    }

    this.moveEnemies();
    this.updateDisplay();
  }

  // 隣接チェックメソッドを追加
  isAdjacent(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }

  // 敵の攻撃処理を追加
  enemyAttack(enemy) {
    this.player.hp = Math.max(0, this.player.hp - enemy.attack);
    this.addMessage(
      `${enemy.type}の攻撃！ ${enemy.attack}のダメージを受けた！`
    );

    if (this.player.hp === 0) {
      this.gameOver = true;
      this.addMessage("ゲームオーバー！");
      this.updateDisplay();
    }
  }

  // ゲームをリセットする新しいメソッド
  resetGame() {
    this.mapSize = 15;
    this.currentFloor = 1;
    this.maps = [];
    this.enemies = [];
    this.items = [];
    this.startPositions = [];
    this.discoveredTiles = new Set();
    this.gameOver = false;
    this.gameClear = false; // クリアフラグもリセット
    this.player = {
      x: 0,
      y: 0,
      level: 1,
      exp: 0,
      hp: 20,
      maxHp: 20,
      attack: 5,
      nextExp: 10,
    };
    this.generateMaps();
    this.currentMap = this.maps[0];
    this.player.x = this.startPositions[0].x;
    this.player.y = this.startPositions[0].y;

    const messageLog = document.getElementById("message-log");
    messageLog.innerHTML = "ゲーム開始！";

    this.updateDisplay();
  }

  // アイテム使用処理の更新
  useItem(item) {
    if (item.effect === "heal") {
      const healAmount = item.value;
      this.player.hp = Math.min(this.player.hp + healAmount, this.player.maxHp);
      this.addMessage(`ポーションを使用して${healAmount}回復した！`);
    } else if (item.effect === "exp") {
      const expAmount = item.value * this.currentFloor;
      this.addExp(expAmount);
      this.addMessage(`経験値の結晶を使用して${expAmount}の経験値を獲得！`);
    }
  }

  showGameClear() {
    const mapDiv = document.getElementById("game-map");

    // 既存のクリア表示があれば削除
    const existingClear = document.querySelector(".game-clear-container");
    if (existingClear) {
      existingClear.remove();
    }

    const clearContainer = document.createElement("div");
    clearContainer.className = "game-clear-container";

    // キラキラエフェクトの追加
    for (let i = 0; i < 12; i++) {
      const sparkle = document.createElement("div");
      sparkle.className = "sparkle";
      clearContainer.appendChild(sparkle);
    }

    const clearDiv = document.createElement("div");
    clearDiv.className = "game-clear-text";
    clearDiv.innerHTML = `
      <span>G</span><span>A</span><span>M</span><span>E</span>
      <br>
      <span>C</span><span>L</span><span>E</span><span>A</span><span>R</span><span>!</span>
    `;

    const statsDiv = document.createElement("div");
    statsDiv.className = "clear-stats";
    statsDiv.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">最終レベル:</span>
        <span class="stat-value">${this.player.level}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">攻撃力:</span>
        <span class="stat-value">${this.player.attack}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">HP:</span>
        <span class="stat-value">${this.player.hp}/${this.player.maxHp}</span>
      </div>
    `;

    const retryButton = document.createElement("button");
    retryButton.className = "retry-button";
    retryButton.textContent = "もう一度プレイ";
    retryButton.onclick = () => this.resetGame();

    clearContainer.appendChild(clearDiv);
    clearContainer.appendChild(statsDiv);
    clearContainer.appendChild(retryButton);
    mapDiv.appendChild(clearContainer);
  }
}

let game = new Game();

function movePlayer(direction) {
  game.movePlayer(direction);
}

document.addEventListener("keydown", (e) => {
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
  ) {
    e.preventDefault();
    if (e.key === " ") {
      game.movePlayer("Wait");
    } else {
      game.movePlayer(e.key);
    }
  }
});
