import { v4 as uuid } from "uuid";
import { Logger } from "../utils";
import type {
  Settings,
  Website,
  Burrow,
  Rabbithole,
  User,
  Trail,
  TrailStop,
  TrailWalk,
} from "../utils/types";

const version = 12;

export class WebsiteStore {
  factory: IDBFactory;
  db: IDBDatabase = null;

  constructor(factory: IDBFactory) {
    this.factory = factory;
  }

  private async getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db !== null) {
        resolve(this.db);
        return;
      }
      let request = this.factory.open("rabbithole", version);
      request.onsuccess = () => {
        const db = request.result;
        db.onerror = (event) => {
          Logger.error("Database error", (event.target as any).error);
        };
        this.db = db;
        resolve(db);
      };
      request.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        Logger.error("Failed to open database", err);
        reject(new Error(`Failed to open database: ${err?.message || err}`));
      };
    });
  }

  static async init(factory: IDBFactory): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (factory === undefined) {
        Logger.error("indexedDB not supported");
        reject(new Error("indexedDB not supported"));
      } else {
        let request = factory.open("rabbithole", version);
        request.onerror = (e) => {
          Logger.error("IndexedDB init error", (e.target as any).error);
          reject(new Error("Insufficient permissions"));
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const txn = (event.target as IDBOpenDBRequest).transaction;

          if (event.oldVersion < 1) {
            const objectStore = db.createObjectStore("savedWebsites", {
              keyPath: "url",
            });
            objectStore.createIndex("name", "name", { unique: false });
            objectStore.createIndex("url", "url", { unique: true });
            objectStore.transaction.oncomplete = () => {};
          }
          if (event.oldVersion < 2) {
            db.createObjectStore("user", { keyPath: "id" });
          }
          if (event.oldVersion < 3) {
            const objectStore = db.createObjectStore("projects", {
              keyPath: "id",
            });
            objectStore.createIndex("name", "name", { unique: true });
          }

          if (event.oldVersion < 6) {
            if (txn.objectStoreNames.contains("projects")) {
              const store = txn.objectStore("projects");
              store.name = "burrows";
              const cursorRequest = store.openCursor();

              cursorRequest.onsuccess = () => {
                const cursor = cursorRequest.result;
                if (!cursor) {
                  return;
                }

                const value = cursor.value;
                if (
                  value &&
                  "savedWebsites" in value &&
                  !("websites" in value)
                ) {
                  value.websites = value.savedWebsites;
                  delete value.savedWebsites;
                  cursor.update(value);
                }

                cursor.continue();
              };
            }

            if (txn.objectStoreNames.contains("savedWebsites")) {
              const store = txn.objectStore("savedWebsites");
              store.name = "websites";
            }

            db.createObjectStore("rabbitholes", { keyPath: "id" });
          }

          if (event.oldVersion < 7) {
            if (txn.objectStoreNames.contains("rabbitholes")) {
              const rhStore = txn.objectStore("rabbitholes");
              if (!rhStore.indexNames.contains("burrows")) {
                rhStore.createIndex("burrows", "burrows", {
                  unique: false,
                  multiEntry: true,
                });
              }
            }
          }

          if (event.oldVersion < 8) {
            if (txn.objectStoreNames.contains("burrows")) {
              const store = txn.objectStore("burrows");
              if (store.indexNames.contains("name")) {
                store.deleteIndex("name");
                store.createIndex("name", "name", { unique: false });
              }
            }
          }

          if (event.oldVersion < 9) {
            const rabbitholeStore = txn.objectStore("rabbitholes");
            const burrowStore = txn.objectStore("burrows");

            // Step 1: Collect all burrow IDs that exist
            const allBurrowIds = new Set<string>();
            const burrowsById = new Map<string, any>();

            const collectBurrowsRequest = burrowStore.openCursor();
            collectBurrowsRequest.onsuccess = (e) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const burrow = cursor.value;
                allBurrowIds.add(burrow.id);
                burrowsById.set(burrow.id, burrow);
                cursor.continue();
              } else {
                // Step 2: Process rabbitholes - clean up invalid burrow references and track used burrows
                const usedBurrowIds = new Set<string>();

                const rhRequest = rabbitholeStore.openCursor();
                rhRequest.onsuccess = (e) => {
                  const rhCursor = (e.target as IDBRequest).result;
                  if (rhCursor) {
                    const rh = rhCursor.value;
                    if (rh.burrows && Array.isArray(rh.burrows)) {
                      // Filter out burrow IDs that don't exist
                      const validBurrows = rh.burrows.filter((id: string) =>
                        allBurrowIds.has(id),
                      );

                      // Track which burrows are used
                      validBurrows.forEach((id: string) =>
                        usedBurrowIds.add(id),
                      );

                      // Update rabbithole if burrows list changed
                      if (validBurrows.length !== rh.burrows.length) {
                        rh.burrows = validBurrows;
                        rhCursor.update(rh);
                      }
                    }
                    rhCursor.continue();
                  } else {
                    // Step 3: Process burrows - convert orphans to rabbitholes, remove activeTabs from others
                    const bRequest = burrowStore.openCursor();
                    bRequest.onsuccess = (e) => {
                      const bCursor = (e.target as IDBRequest).result;
                      if (bCursor) {
                        const burrow = bCursor.value;

                        if (!usedBurrowIds.has(burrow.id)) {
                          // Orphan burrow -> convert to Rabbithole
                          const newRh = {
                            id: burrow.id,
                            createdAt: burrow.createdAt,
                            burrows: [],
                            title: burrow.name,
                            description: "",
                            meta: burrow.websites || [],
                            // Preserve activeTabs if it exists (moved from burrows to rabbitholes)
                            activeTabs: burrow.activeTabs || [],
                          };
                          rabbitholeStore.put(newRh);
                          bCursor.delete();
                        } else {
                          // Remove activeTabs property from burrows (now only on rabbitholes)
                          if ("activeTabs" in burrow) {
                            delete burrow.activeTabs;
                            bCursor.update(burrow);
                          }
                        }
                        bCursor.continue();
                      }
                    };
                  }
                };
              }
            };
          }

          if (event.oldVersion < 10) {
            const rabbitholeStore = txn.objectStore("rabbitholes");
            const burrowStore = txn.objectStore("burrows");
            const userStore = txn.objectStore("user");

            // Reset hasSeenOnboarding
            const userReq = userStore.openCursor();
            userReq.onsuccess = (e) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const user = cursor.value;
                if (user.settings) {
                  user.settings.hasSeenOnboarding = false;
                  cursor.update(user);
                }
                cursor.continue();
              }
            };

            // Delete empty "Home" or "Homebase" rabbitholes
            const rhReq = rabbitholeStore.openCursor();
            rhReq.onsuccess = (e) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const rh = cursor.value;
                if (
                  (rh.title === "Home" || rh.title === "Homebase") &&
                  (!rh.burrows || rh.burrows.length === 0) &&
                  (!rh.meta || rh.meta.length === 0)
                ) {
                  cursor.delete();
                }
                cursor.continue();
              }
            };

            // Delete empty "Bookmarks" or "Reminders" burrows
            const bReq = burrowStore.openCursor();
            bReq.onsuccess = (e) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const b = cursor.value;
                if (
                  (b.name === "Bookmarks" || b.name === "Reminders") &&
                  (!b.websites || b.websites.length === 0)
                ) {
                  cursor.delete();
                }
                cursor.continue();
              }
            };
          }

          if (event.oldVersion < 11) {
            db.createObjectStore("trails", { keyPath: "id" });
            const rhStore = txn.objectStore("rabbitholes");
            const rhReq = rhStore.openCursor();
            rhReq.onsuccess = (e) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const rh = cursor.value;
                if (!rh.trails) {
                  rh.trails = [];
                  cursor.update(rh);
                }
                cursor.continue();
              }
            };
          }

          if (event.oldVersion < 12) {
            db.createObjectStore("trailWalks", { keyPath: "id" });
          }
        };

        request.onsuccess = () => {
          const db = request.result;

          const userRequest = db
            .transaction(["user"])
            .objectStore("user")
            .getAll();
          userRequest.onsuccess = () => {
            const [user] = userRequest.result;
            if (user === undefined) {
              const newUser: User = {
                id: uuid(),
                settings: {
                  show: true,
                  alignment: "right",
                  darkMode: false,
                  hasSeenOnboarding: false,
                },
                currentBurrow: null,
                currentTrail: null,
                currentRabbithole: null,
              };
              const addRequest = db
                .transaction(["user"], "readwrite")
                .objectStore("user")
                .add(newUser);

              addRequest.onsuccess = () => resolve();
              addRequest.onerror = () => resolve();
            } else {
              // Ensure currentTrail exists on legacy user records
              if (!("currentTrail" in user)) {
                user.currentTrail = null;
                const updateReq = db
                  .transaction(["user"], "readwrite")
                  .objectStore("user")
                  .put(user);
                updateReq.onsuccess = () => resolve();
                updateReq.onerror = () => resolve();
              } else {
                resolve();
              }
            }
          };
          userRequest.onerror = () => resolve();
        };
      }
    });
  }

  async fetchRabbitholeForBurrow(burrowId: string): Promise<Rabbithole> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes"], "readonly");
      const store = tx.objectStore("rabbitholes");

      if (!store.indexNames.contains("burrows")) {
        reject(new Error("Missing index: rabbitholes.burrows"));
        return;
      }

      const idx = store.index("burrows");
      const req = idx.get(burrowId);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(new Error("Failed to fetch rabbitholes for burrow"));
    });
  }

  async deleteBurrowFromRabbithole(
    rabbitholeId: string,
    burrowId: string,
  ): Promise<Rabbithole> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes"], "readwrite");
      const store = tx.objectStore("rabbitholes");
      const getRequest = store.get(rabbitholeId);

      getRequest.onsuccess = () => {
        const rabbithole = getRequest.result as Rabbithole;
        if (!rabbithole) {
          reject(new Error("Rabbithole not found"));
          return;
        }

        rabbithole.burrows = (rabbithole.burrows || []).filter(
          (id) => id !== burrowId,
        );

        const putRequest = store.put(rabbithole);
        putRequest.onsuccess = () => resolve(rabbithole);
        putRequest.onerror = (event) =>
          reject(new Error((event.target as IDBRequest).error.message));
      };

      getRequest.onerror = (event) =>
        reject(new Error((event.target as IDBRequest).error.message));
    });
  }

  async getAllRabbitholes(): Promise<Rabbithole[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(["rabbitholes"])
        .objectStore("rabbitholes")
        .getAll();

      request.onsuccess = (_) => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        reject(
          new Error(`Failed to retrieve rabbitholes: ${err?.message || err}`),
        );
      };
    });
  }

  async getRabbithole(rabbitholeId: string): Promise<Rabbithole | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const rabbitholeRequest = db
        .transaction(["rabbitholes"], "readwrite")
        .objectStore("rabbitholes")
        .get(rabbitholeId);

      rabbitholeRequest.onsuccess = () => {
        resolve(rabbitholeRequest.result);
      };

      rabbitholeRequest.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        reject(
          new Error(`Failed to retrieve rabbithole: ${err?.message || err}`),
        );
      };
    });
  }

  async getActiveRabbithole(): Promise<Rabbithole | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const userRequest = db.transaction(["user"]).objectStore("user").getAll();

      userRequest.onsuccess = async (_) => {
        const [user] = userRequest.result;

        if (!user.currentRabbithole) {
          resolve(null);
          return;
        }

        const activeRabbithole = await this.getRabbithole(
          user.currentRabbithole,
        );
        resolve(activeRabbithole);
      };

      userRequest.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        reject(new Error(`Failed to retrieve user: ${err?.message || err}`));
      };
    });
  }

  async changeActiveRabbithole(rabbitholeId: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const userRequest = db.transaction(["user"]).objectStore("user").getAll();

      userRequest.onsuccess = () => {
        const [user] = userRequest.result;
        user.currentRabbithole = rabbitholeId;

        const userPutRequest = db
          .transaction(["user"], "readwrite")
          .objectStore("user")
          .put(user);

        userPutRequest.onsuccess = () => {
          resolve();
        };

        userPutRequest.onerror = (event) => {
          const err = (event.target as IDBRequest).error;
          reject(new Error(`Failed to update user: ${err?.message || err}`));
        };
      };

      userRequest.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        reject(new Error(`Failed to retrieve user: ${err?.message || err}`));
      };
    });
  }

  async createNewActiveRabbithole(
    title: string,
    description?: string,
  ): Promise<Rabbithole> {
    const db = await this.getDb();
    const user = await this.getUser();

    const rabbithole: Rabbithole = {
      id: uuid(),
      createdAt: Date.now(),
      burrows: [],
      trails: [],
      title,
      description,
      meta: [],
    };

    return new Promise((resolve, reject) => {
      const rabbitholeReq = db
        .transaction(["rabbitholes"], "readwrite")
        .objectStore("rabbitholes")
        .put(rabbithole);

      // set rabbithole as active
      rabbitholeReq.onsuccess = () => {
        const userReq = db
          .transaction(["user"], "readwrite")
          .objectStore("user")
          .put({
            ...user,
            currentRabbithole: rabbithole.id,
            currentBurrow: null,
            currentTrail: null,
          });

        userReq.onsuccess = () => {
          resolve(rabbithole);
        };

        userReq.onerror = (event) => {
          reject(new Error((event.target as IDBRequest).error.message));
        };
      };

      rabbitholeReq.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        reject(
          new Error(`Failed to create rabbithole: ${err?.message || err}`),
        );
      };
    });
  }

  async updateRabbithole(
    rabbitholeId: string,
    title?: string,
    description?: string,
  ): Promise<Rabbithole> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes"], "readwrite");
      const store = tx.objectStore("rabbitholes");
      const getRequest = store.get(rabbitholeId);

      getRequest.onsuccess = () => {
        const rabbithole = getRequest.result;
        if (!rabbithole) {
          reject(new Error("Rabbithole not found"));
          return;
        }

        if (title !== undefined) {
          rabbithole.title = title;
        }
        if (description !== undefined) {
          rabbithole.description = description;
        }

        const putRequest = store.put(rabbithole);

        putRequest.onsuccess = () => {
          resolve(rabbithole);
        };

        putRequest.onerror = (event) => {
          reject(new Error((event.target as IDBRequest).error.message));
        };
      };

      getRequest.onerror = (event) => {
        reject(new Error((event.target as IDBRequest).error.message));
      };
    });
  }

  async deleteRabbithole(rabbitholeId: string): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const rabbitholeTx = db.transaction(["rabbitholes"], "readwrite");
      const rabbitholeStore = rabbitholeTx.objectStore("rabbitholes");
      const getRequest = rabbitholeStore.get(rabbitholeId);

      getRequest.onsuccess = async () => {
        const rabbithole: Rabbithole = getRequest.result;
        if (!rabbithole) {
          reject(new Error("Rabbithole not found"));
          return;
        }

        const deleteRabbitholeReq = db
          .transaction(["rabbitholes"], "readwrite")
          .objectStore("rabbitholes")
          .delete(rabbitholeId);

        deleteRabbitholeReq.onsuccess = async () => {
          for (const trailId of rabbithole.trails || []) {
            await this.deleteTrail(trailId);
          }
          resolve();
        };

        deleteRabbitholeReq.onerror = (event) => {
          reject(new Error((event.target as IDBRequest).error.message));
        };
      };

      getRequest.onerror = (event) => {
        reject(new Error((event.target as IDBRequest).error.message));
      };
    });
  }

  async addBurrowsToRabbithole(
    rabbitholeId: string,
    burrowIds: string[],
  ): Promise<Rabbithole> {
    const db = await this.getDb();

    const existingBurrows = await Promise.all(
      burrowIds.map((id) => this.getBurrow(id).catch(() => null)),
    );

    const validBurrowIds = existingBurrows
      .filter(Boolean)
      .map((b: Burrow) => b.id);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes"], "readwrite");
      const store = tx.objectStore("rabbitholes");
      const getRequest = store.get(rabbitholeId);

      getRequest.onsuccess = () => {
        const rabbithole = getRequest.result;
        if (!rabbithole) {
          reject(new Error("Rabbithole not found"));
          return;
        }

        rabbithole.burrows = [
          ...new Set([...(rabbithole.burrows || []), ...validBurrowIds]),
        ];

        const putRequest = store.put(rabbithole);
        putRequest.onsuccess = () => resolve(rabbithole);
        putRequest.onerror = (event) =>
          reject(new Error((event.target as IDBRequest).error.message));
      };

      getRequest.onerror = (event) =>
        reject(new Error((event.target as IDBRequest).error.message));
    });
  }

  async createNewBurrowInActiveRabbithole(
    burrowName: string,
    websites: string[] = [],
  ): Promise<Burrow> {
    const db = await this.getDb();
    const user = await this.getUser();

    const burrow: Burrow = {
      id: uuid(),
      createdAt: Date.now(),
      name: burrowName,
      websites: [...new Set(websites)],
    };

    return new Promise((resolve, reject) => {
      const burrowReq = db
        .transaction(["burrows"], "readwrite")
        .objectStore("burrows")
        .put(burrow);

      burrowReq.onsuccess = async () => {
        const rabbithole = await this.getActiveRabbithole();
        await this.addBurrowsToRabbithole(rabbithole.id, [burrow.id]);

        const userReq = db
          .transaction(["user"], "readwrite")
          .objectStore("user")
          .put({
            ...user,
            currentBurrow: burrow.id,
            currentTrail: null,
          });

        userReq.onsuccess = () => resolve(burrow);
        userReq.onerror = (event) =>
          reject(new Error((event.target as IDBRequest).error.message));
      };

      burrowReq.onerror = (event) => {
        reject(new Error((event.target as IDBRequest).error.message));
      };
    });
  }

  async addWebsitesToRabbitholeMeta(
    rabbitholeId: string,
    urls: string[],
  ): Promise<Rabbithole> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes"], "readwrite");
      const store = tx.objectStore("rabbitholes");
      const getRequest = store.get(rabbitholeId);

      getRequest.onsuccess = () => {
        const rabbithole = getRequest.result;
        if (!rabbithole) {
          reject(new Error("Rabbithole not found"));
          return;
        }

        rabbithole.meta = [...new Set([...(rabbithole.meta || []), ...urls])];

        const putRequest = store.put(rabbithole);
        putRequest.onsuccess = () => resolve(rabbithole);
        putRequest.onerror = (event) =>
          reject(new Error((event.target as IDBRequest).error.message));
      };

      getRequest.onerror = (event) =>
        reject(new Error((event.target as IDBRequest).error.message));
    });
  }

  async deleteWebsiteFromRabbitholeMeta(
    rabbitholeId: string,
    url: string,
  ): Promise<Rabbithole> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes"], "readwrite");
      const store = tx.objectStore("rabbitholes");
      const getRequest = store.get(rabbitholeId);

      getRequest.onsuccess = () => {
        const rabbithole = getRequest.result;
        if (!rabbithole) {
          reject(new Error("Rabbithole not found"));
          return;
        }

        rabbithole.meta = (rabbithole.meta || []).filter((u) => u !== url);

        const putRequest = store.put(rabbithole);
        putRequest.onsuccess = () => resolve(rabbithole);
        putRequest.onerror = (event) =>
          reject(new Error((event.target as IDBRequest).error.message));
      };

      getRequest.onerror = (event) =>
        reject(new Error((event.target as IDBRequest).error.message));
    });
  }

  // also adds website to savedWebsites if it isn't there already
  async saveWebsitesToBurrow(
    items: Website[],
  ): Promise<Website | { alreadySaved: boolean }[]> {
    const db = await this.getDb();

    let currentBurrow = await this.getActiveBurrow();
    for (let item of items) {
      if (!currentBurrow.websites.includes(item.url)) {
        currentBurrow.websites.push(item.url);
        item.alreadySaved = false;
      } else {
        item.alreadySaved = true;
      }
    }

    return new Promise((resolve, reject) => {
      const burrowRequest = db
        .transaction(["burrows"], "readwrite")
        .objectStore("burrows")
        .put(currentBurrow);

      burrowRequest.onsuccess = (event) => {
        const tx = db.transaction(["websites"], "readwrite");
        const store = tx.objectStore("websites");

        items.forEach((item) => {
          // Use add instead of put to avoid overwriting existing websites
          // This preserves original savedAt, title, description etc.
          const req = store.add(item);
          req.onerror = (e) => {
            // Ignore ConstraintError (duplicate key) to prevent transaction abort
            // This means the website already exists, which is what we want
            e.preventDefault();
            e.stopPropagation();
          };
        });

        tx.oncomplete = async () => {
          resolve(items);
        };

        tx.onerror = (event) => {
          const err = (event.target as IDBRequest).error;
          Logger.error("saveWebsitesToBurrow transaction failed", err);
          reject(
            new Error(
              `saveWebsitesToBurrow transaction failed: ${err?.message || err}`,
            ),
          );
        };
      };

      burrowRequest.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        Logger.error("saveWebsitesToBurrow failed", err);
        reject(
          new Error(`saveWebsitesToBurrow failed: ${err?.message || err}`),
        );
      };
    });
  }

  async saveWebsites(items: Website[]): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["websites"], "readwrite");
      const store = tx.objectStore("websites");

      items.forEach((item) => {
        // Use put to upsert (overwrite if exists)
        store.put(item);
      });

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        reject(new Error(`Failed to save websites: ${err?.message || err}`));
      };
    });
  }

  async updateWebsite(
    url: string,
    name?: string,
    description?: string,
  ): Promise<Website> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["websites"], "readwrite");
      const store = tx.objectStore("websites");
      const getRequest = store.get(url);

      getRequest.onsuccess = () => {
        const website = getRequest.result;
        if (!website) {
          reject(new Error("Website not found"));
          return;
        }

        if (name !== undefined) website.name = name;
        if (description !== undefined) website.description = description;

        const putRequest = store.put(website);
        putRequest.onsuccess = () => resolve(website);
        putRequest.onerror = (event) =>
          reject(new Error((event.target as IDBRequest).error.message));
      };

      getRequest.onerror = (event) =>
        reject(new Error((event.target as IDBRequest).error.message));
    });
  }

  async deleteWebsiteFromBurrow(burrowId: string, url: string): Promise<void> {
    const db = await this.getDb();

    let burrow = await this.getBurrow(burrowId);

    burrow.websites = burrow.websites.filter((w) => {
      return w !== url;
    });

    return new Promise((resolve, reject) => {
      const burrowRequest = db
        .transaction(["burrows"], "readwrite")
        .objectStore("burrows")
        .put(burrow);

      burrowRequest.onsuccess = (event) => {
        resolve();
      };

      burrowRequest.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        if (!err?.message?.includes("exists")) {
          reject(
            new Error(
              `Failed to delete website from burrow: ${err?.message || err}`,
            ),
          );
        }
      };
    });
  }

  async addWebsitesToBurrow(burrowId: string, urls: string[]): Promise<void> {
    const db = await this.getDb();
    const burrow = await this.getBurrow(burrowId);
    const existing = new Set(burrow.websites);
    for (const url of urls) {
      existing.add(url);
    }
    burrow.websites = [...existing];

    return new Promise((resolve, reject) => {
      const req = db
        .transaction(["burrows"], "readwrite")
        .objectStore("burrows")
        .put(burrow);
      req.onsuccess = () => resolve();
      req.onerror = (e) =>
        reject(new Error((e.target as IDBRequest).error?.message));
    });
  }

  async getWebsite(url: string): Promise<Website> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(["websites"])
        .objectStore("websites")
        .get(url);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        reject(new Error(`Failed to retrieve items: ${err?.message || err}`));
      };
    });
  }

  async getAllWebsites(): Promise<Website[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(["websites"])
        .objectStore("websites")
        .getAll();

      request.onsuccess = (_) => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(new Error("Failed to retrieve items"));
      };
    });
  }

  async renameBurrow(burrowId: string, newName: string): Promise<Burrow> {
    const db = await this.getDb();

    let burrow = await this.getBurrow(burrowId);
    burrow.name = newName;

    return new Promise((resolve, reject) => {
      const burrowRequest = db
        .transaction(["burrows"], "readwrite")
        .objectStore("burrows")
        .put(burrow);

      burrowRequest.onsuccess = (event) => {
        resolve(burrow);
      };

      burrowRequest.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        reject(new Error(`Failed to delete burrow: ${err?.message || err}`));
      };
    });
  }

  async deleteBurrow(burrowId: string): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const burrowRequest = db
        .transaction(["burrows"], "readwrite")
        .objectStore("burrows")
        .delete(burrowId);

      burrowRequest.onsuccess = () => resolve();

      burrowRequest.onerror = (event) => {
        reject(new Error((event.target as IDBRequest).error.message));
      };
    });
  }

  async updateSettings(settings: Settings): Promise<Settings> {
    const db = await this.getDb();
    let user = await this.getUser();
    user.settings = settings;

    return new Promise((resolve, reject) => {
      const request = db
        .transaction(["user"], "readwrite")
        .objectStore("user")
        .put(user);

      request.onsuccess = (event) => {
        resolve(settings);
      };

      request.onerror = (event) => {
        reject(new Error((event.target as IDBRequest).error.message));
      };
    });
  }

  async getSettings(): Promise<Settings> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(["user"]).objectStore("user").getAll();

      request.onsuccess = (_) => {
        const [user] = request.result;
        resolve(user.settings);
      };

      request.onerror = (event) => {
        reject(new Error("Failed to retrieve settings"));
      };
    });
  }

  async getUser(): Promise<User> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(["user"]).objectStore("user").getAll();

      request.onsuccess = (_) => {
        const [user] = request.result;
        resolve(user);
      };

      request.onerror = (event) => {
        reject(new Error("Failed to retrieve user"));
      };
    });
  }

  async getActiveBurrow(): Promise<Burrow | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const userRequest = db.transaction(["user"]).objectStore("user").getAll();

      userRequest.onsuccess = (_) => {
        const [user] = userRequest.result;

        if (!user.currentBurrow) {
          resolve(null);
          return;
        }

        const burrowRequest = db
          .transaction(["burrows"], "readwrite")
          .objectStore("burrows")
          .get(user.currentBurrow);

        burrowRequest.onsuccess = () => {
          const burrow = burrowRequest.result;
          resolve(burrow);
        };

        burrowRequest.onerror = (event) => {
          const err = (event.target as IDBRequest).error;
          reject(
            new Error(
              `Failed to retrieve active burrow: ${err?.message || err}`,
            ),
          );
        };
      };

      userRequest.onerror = (event) => {
        reject(new Error("Failed to retrieve settings"));
      };
    });
  }

  async getAllBurrows(): Promise<Burrow[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(["burrows"])
        .objectStore("burrows")
        .getAll();

      request.onsuccess = (_) => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(new Error("Failed to retrieve items"));
      };
    });
  }

  async getBurrow(burrowId: string): Promise<Burrow> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(["burrows"])
        .objectStore("burrows")
        .get(burrowId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(new Error("Failed to retrieve items"));
      };
    });
  }

  async getAllWebsitesForBurrow(burrowId: string): Promise<Website[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const burrow = await this.getBurrow(burrowId);
        const websites = await Promise.all(
          burrow?.websites?.map(async (w) => await this.getWebsite(w)) ?? [],
        );
        resolve(websites);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAllWebsitesForRabbithole(rabbitholeId: string): Promise<Website[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes", "websites"], "readonly");
      const rhStore = tx.objectStore("rabbitholes");

      const rhReq = rhStore.get(rabbitholeId);
      rhReq.onsuccess = async () => {
        const rh: Rabbithole = rhReq.result;
        if (!rh) {
          resolve([]);
          return;
        }
        const websites = await Promise.all(
          rh?.meta?.map(async (w) => await this.getWebsite(w)) ?? [],
        );

        resolve(websites);
      };
      rhReq.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async changeActiveBurrow(burrowId: string | null): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const userRequest = db.transaction(["user"]).objectStore("user").getAll();

      userRequest.onsuccess = async () => {
        const [user] = userRequest.result;
        user.currentBurrow = burrowId;

        const userPutRequest = db
          .transaction(["user"], "readwrite")
          .objectStore("user")
          .put(user);

        userPutRequest.onsuccess = () => resolve();
        userPutRequest.onerror = (event) => {
          const err = (event.target as IDBRequest).error;
          reject(
            new Error(`Failed to change active burrow: ${err?.message || err}`),
          );
        };
      };

      userRequest.onerror = (event) => {
        reject(new Error("Failed to retrieve settings"));
      };
    });
  }

  async createNewActiveBurrow(
    burrowName: string,
    websites: string[] = [],
  ): Promise<Burrow> {
    const db = await this.getDb();
    const user = await this.getUser();
    const burrow: Burrow = {
      id: uuid(),
      createdAt: Date.now(),
      name: burrowName,
      websites: [...new Set(websites)],
    };

    return new Promise((resolve, reject) => {
      // FIXME: when rabbithole is installed, the first time a session is saved
      // the website list is duplicated, so dedup here for now
      // Also see how else this can be repro'd
      const burrowReq = db
        .transaction(["burrows"], "readwrite")
        .objectStore("burrows")
        .put(burrow);

      burrowReq.onsuccess = () => {
        const userReq = db
          .transaction(["user"], "readwrite")
          .objectStore("user")
          .put({
            ...user,
            currentBurrow: burrow.id,
            currentTrail: null,
          });

        userReq.onsuccess = () => {
          resolve(burrow);
        };

        userReq.onerror = (event) => {
          reject(new Error((event.target as IDBRequest).error.message));
        };
      };

      burrowReq.onerror = (event) => {
        const err = (event.target as IDBRequest).error;
        reject(new Error(`Failed to create burrow: ${err?.message || err}`));
      };
    });
  }

  async updateBurrowSembleInfo(
    burrowId: string,
    uri: string,
    syncTime: number,
  ): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["burrows"], "readwrite");
      const store = tx.objectStore("burrows");
      const getRequest = store.get(burrowId);

      getRequest.onsuccess = () => {
        const burrow = getRequest.result;
        if (!burrow) {
          reject(new Error(`Burrow not found: ${burrowId}`));
          return;
        }

        burrow.sembleCollectionUri = uri;
        burrow.lastSembleSync = syncTime;

        const putRequest = store.put(burrow);

        putRequest.onsuccess = () => {
          resolve();
        };

        putRequest.onerror = (event) => {
          reject(new Error((event.target as IDBRequest).error.message));
        };
      };

      getRequest.onerror = (event) => {
        reject(new Error((event.target as IDBRequest).error.message));
      };
    });
  }

  async updateRabbitholeActiveTabs(
    rabbitholeId: string,
    urls: string[],
  ): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes"], "readwrite");
      const store = tx.objectStore("rabbitholes");
      const getRequest = store.get(rabbitholeId);

      getRequest.onsuccess = () => {
        const rabbithole = getRequest.result;
        if (!rabbithole) {
          reject(new Error("Rabbithole not found"));
          return;
        }

        rabbithole.activeTabs = urls;

        const putRequest = store.put(rabbithole);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = (e) => reject((e.target as IDBRequest).error);
      };
      getRequest.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async removeWebsiteFromRabbitholeActiveTabs(
    rabbitholeId: string,
    url: string,
  ): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes"], "readwrite");
      const store = tx.objectStore("rabbitholes");
      const getRequest = store.get(rabbitholeId);

      getRequest.onsuccess = () => {
        const rabbithole = getRequest.result;
        if (!rabbithole) {
          reject(new Error("Rabbithole not found"));
          return;
        }

        if (rabbithole.activeTabs) {
          rabbithole.activeTabs = rabbithole.activeTabs.filter(
            (u) => u !== url,
          );
        }

        const putRequest = store.put(rabbithole);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = (e) => reject((e.target as IDBRequest).error);
      };
      getRequest.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async createTrail(
    rabbitholeId: string,
    name: string,
    websites: string[],
  ): Promise<Trail> {
    const db = await this.getDb();

    const trailStops: TrailStop[] = websites.map((url) => ({
      websiteUrl: url,
      note: "",
    }));

    const trail: Trail = {
      id: uuid(),
      createdAt: Date.now(),
      name,
      rabbitholeId,
      stops: trailStops,
      startNote: "",
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["trails", "rabbitholes"], "readwrite");
      const trailStore = tx.objectStore("trails");
      const rhStore = tx.objectStore("rabbitholes");

      trailStore.put(trail);

      const rhReq = rhStore.get(rabbitholeId);
      rhReq.onsuccess = () => {
        const rh = rhReq.result;
        if (rh) {
          rh.trails = [...(rh.trails || []), trail.id];
          rhStore.put(rh);
        }
      };

      tx.oncomplete = () => resolve(trail);
      tx.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async createNewActiveTrail(
    rabbitholeId: string,
    name: string,
    websites: string[],
  ): Promise<Trail> {
    const trail = await this.createTrail(rabbitholeId, name, websites);
    await this.changeActiveTrail(trail.id);
    return trail;
  }

  async getTrail(trailId: string): Promise<Trail> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(["trails"]).objectStore("trails").get(trailId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async getActiveTrail(): Promise<Trail | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const userReq = db.transaction(["user"]).objectStore("user").getAll();
      userReq.onsuccess = () => {
        const [user] = userReq.result;
        if (!user.currentTrail) {
          return resolve(null);
        }
        const trailReq = db
          .transaction(["trails"])
          .objectStore("trails")
          .get(user.currentTrail);
        trailReq.onsuccess = () => resolve(trailReq.result);
        trailReq.onerror = (e) => reject((e.target as IDBRequest).error);
      };
    });
  }

  async changeActiveTrail(trailId: string | null): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const userRequest = db
        .transaction(["user"], "readwrite")
        .objectStore("user")
        .getAll();
      userRequest.onsuccess = () => {
        const [user] = userRequest.result;
        user.currentTrail = trailId;
        const putReq = db
          .transaction(["user"], "readwrite")
          .objectStore("user")
          .put(user);
        putReq.onsuccess = () => resolve();
        putReq.onerror = (e) => reject((e.target as IDBRequest).error);
      };
    });
  }

  async updateTrail(trailId: string, updates: Partial<Trail>): Promise<Trail> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["trails"], "readwrite");
      const store = tx.objectStore("trails");
      const req = store.get(trailId);
      req.onsuccess = () => {
        const trail = req.result;
        if (!trail) {
          return reject(new Error("Trail not found"));
        }
        Object.assign(trail, updates);
        store.put(trail);
        tx.oncomplete = () => resolve(trail);
      };
    });
  }

  async deleteTrailFromRabbithole(
    rabbitholeId: string,
    trailId: string,
  ): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["rabbitholes"], "readwrite");
      const rhStore = tx.objectStore("rabbitholes");
      const rhReq = rhStore.get(rabbitholeId);
      rhReq.onsuccess = () => {
        const rh = rhReq.result;
        if (rh && rh.trails) {
          rh.trails = rh.trails.filter((id) => id !== trailId);
          rhStore.put(rh);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject((e.target as IDBRequest).error);
      };
      rhReq.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async deleteTrail(trailId: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const req = db
        .transaction(["trails"], "readwrite")
        .objectStore("trails")
        .delete(trailId);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async startTrailWalk(trailId: string): Promise<TrailWalk> {
    await this.abandonTrailWalk(trailId).catch(() => {});
    const db = await this.getDb();
    const walk: TrailWalk = {
      id: uuid(),
      trailId,
      visitedStops: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completed: false,
    };
    return new Promise((resolve, reject) => {
      const req = db
        .transaction(["trailWalks"], "readwrite")
        .objectStore("trailWalks")
        .put(walk);
      req.onsuccess = () => resolve(walk);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async getTrailWalk(trailId: string): Promise<TrailWalk | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const req = db
        .transaction(["trailWalks"])
        .objectStore("trailWalks")
        .getAll();
      req.onsuccess = () => {
        const walks: TrailWalk[] = req.result;
        const active =
          walks
            .filter((w) => w.trailId === trailId && !w.completed)
            .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
        resolve(active);
      };
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async advanceTrailWalk(
    trailId: string,
    websiteUrl: string,
  ): Promise<TrailWalk> {
    const db = await this.getDb();
    const walk = await this.getTrailWalk(trailId);
    if (!walk) throw new Error("No active walk for this trail");
    if (!walk.visitedStops.includes(websiteUrl)) {
      walk.visitedStops.push(websiteUrl);
    }
    walk.updatedAt = Date.now();
    return new Promise((resolve, reject) => {
      const req = db
        .transaction(["trailWalks"], "readwrite")
        .objectStore("trailWalks")
        .put(walk);
      req.onsuccess = () => resolve(walk);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async completeTrailWalk(trailId: string): Promise<void> {
    const db = await this.getDb();
    const walk = await this.getTrailWalk(trailId);
    if (!walk) return;
    walk.completed = true;
    walk.updatedAt = Date.now();
    return new Promise((resolve, reject) => {
      const req = db
        .transaction(["trailWalks"], "readwrite")
        .objectStore("trailWalks")
        .put(walk);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }

  async abandonTrailWalk(trailId: string): Promise<void> {
    const db = await this.getDb();
    const walk = await this.getTrailWalk(trailId);
    if (!walk) return;
    return new Promise((resolve, reject) => {
      const req = db
        .transaction(["trailWalks"], "readwrite")
        .objectStore("trailWalks")
        .delete(walk.id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  }
}
