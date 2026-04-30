import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/board" },
    { path: "/board", component: () => import("./views/BoardView.vue") },
    { path: "/admin", component: () => import("./views/AdminView.vue") }
  ]
});
