import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'gallery',
            component: () => import('./views/GalleryView.vue'),
        },
        {
            path: '/photo/:id',
            name: 'photo-detail',
            component: () => import('./views/PhotoDetailView.vue'),
            props: true,
        },
    ],
});

export default router;
