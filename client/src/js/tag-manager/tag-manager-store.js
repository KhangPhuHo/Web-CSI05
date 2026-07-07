// ======================================================
// Tag Manager Store
// Firestore Data Layer
// ======================================================

import { db } from "../firebase-config.js";

import {
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    doc,
    getDocs,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import {
    slugify,
    isSameName,
    sortAZ
} from "./tag-manager-utils.js";

export default class TagStore {

    constructor(collectionName = "genres") {

        this.collectionName = collectionName;

        this.collectionRef =
            collection(db, collectionName);

        this.items = [];

        this.unsubscribe = null;

        this.listeners = new Set();

    }

    //--------------------------------------------------
    // Subscribe
    //--------------------------------------------------

    subscribe(callback) {

        this.listeners.add(callback);

        callback([...this.items]);

        return () => {

            this.listeners.delete(callback);

        };

    }

    notify() {

        const clone = [...this.items];

        this.listeners.forEach(cb => cb(clone));

    }

    //--------------------------------------------------
    // Load Once
    //--------------------------------------------------

    async load() {

        const q = query(
            this.collectionRef,
            orderBy("name")
        );

        const snapshot = await getDocs(q);

        this.items = [];

        snapshot.forEach(docSnap => {

            this.items.push({

                id: docSnap.id,

                ...docSnap.data()

            });

        });

        this.items = sortAZ(this.items);

        this.notify();

        return this.items;

    }

    //--------------------------------------------------
    // Realtime
    //--------------------------------------------------

    startRealtime() {

        if (this.unsubscribe)
            this.unsubscribe();

        const q = query(
            this.collectionRef,
            orderBy("name")
        );

        this.unsubscribe = onSnapshot(
            q,
            snapshot => {

                this.items = [];

                snapshot.forEach(docSnap => {

                    this.items.push({

                        id: docSnap.id,

                        ...docSnap.data()

                    });

                });

                this.items = sortAZ(this.items);

                this.notify();

            }
        );

    }

    stopRealtime() {

        if (this.unsubscribe) {

            this.unsubscribe();

            this.unsubscribe = null;

        }

    }

    //--------------------------------------------------
    // Getters
    //--------------------------------------------------

    getAll() {

        return [...this.items];

    }

    getById(id) {

        return this.items.find(
            item => item.id === id
        );

    }

    getByName(name) {

        return this.items.find(item =>
            isSameName(item.name, name)
        );

    }

    exists(name) {

        return !!this.getByName(name);

    }

    //--------------------------------------------------
    // Create
    //--------------------------------------------------

    async create(name) {

        name = name.trim();

        if (!name.length)
            throw new Error("Empty name");

        if (this.exists(name))
            throw new Error("Genre already exists");

        const data = {

            name,

            slug: slugify(name),

            createdAt: serverTimestamp(),

            updatedAt: serverTimestamp(),

            count: 0

        };

        const ref = await addDoc(
            this.collectionRef,
            data
        );

        return ref.id;

    }

        //--------------------------------------------------
    // Rename
    //--------------------------------------------------

    async rename(id, newName) {

        newName = newName.trim();

        if (!newName.length)
            throw new Error("Empty name");

        const current = this.getById(id);

        if (!current)
            throw new Error("Genre not found");

        const duplicated = this.items.find(item => {

            return (
                item.id !== id &&
                isSameName(item.name, newName)
            );

        });

        if (duplicated)
            throw new Error("Genre already exists");

        await updateDoc(
            doc(db, this.collectionName, id),
            {

                name: newName,

                slug: slugify(newName),

                updatedAt: serverTimestamp()

            }
        );

    }

    //--------------------------------------------------
    // Delete
    //--------------------------------------------------

    async delete(id) {

        const current = this.getById(id);

        if (!current)
            throw new Error("Genre not found");

        await deleteDoc(
            doc(
                db,
                this.collectionName,
                id
            )
        );

    }

    //--------------------------------------------------
    // Count
    //--------------------------------------------------

    async increaseCount(id) {

        const current = this.getById(id);

        if (!current)
            return;

        const value =
            Number(current.count || 0);

        await updateDoc(
            doc(
                db,
                this.collectionName,
                id
            ),
            {

                count: value + 1,

                updatedAt: serverTimestamp()

            }
        );

    }

    async decreaseCount(id) {

        const current = this.getById(id);

        if (!current)
            return;

        const value =
            Math.max(
                0,
                Number(current.count || 0) - 1
            );

        await updateDoc(
            doc(
                db,
                this.collectionName,
                id
            ),
            {

                count: value,

                updatedAt: serverTimestamp()

            }
        );

    }

    //--------------------------------------------------
    // Refresh
    //--------------------------------------------------

    async refresh() {

        return await this.load();

    }

    //--------------------------------------------------
    // Search
    //--------------------------------------------------

    search(keyword = "") {

        keyword = keyword
            .trim()
            .toLowerCase();

        if (!keyword.length)
            return [...this.items];

        return this.items.filter(item => {

            return (

                item.name
                    .toLowerCase()
                    .includes(keyword)

                ||

                item.slug
                    .includes(keyword)

            );

        });

    }

    //--------------------------------------------------
    // Popular
    //--------------------------------------------------

    getPopular(limit = 10) {

        return [...this.items]
            .sort((a, b) => {

                return (b.count || 0)
                    - (a.count || 0);

            })
            .slice(0, limit);

    }

    //--------------------------------------------------
    // Destroy
    //--------------------------------------------------

    destroy() {

        this.stopRealtime();

        this.listeners.clear();

        this.items = [];

    }

}