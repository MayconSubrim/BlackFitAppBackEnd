import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // validação básica
        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        // verificar se já existe usuário com esse email
        const userExists = await prisma.user.findUnique({
            where: { email }
        });

        if (userExists) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        // criptografar senha
        const hash = await bcrypt.hash(password.toString(), 10);

        // criar usuário
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hash,
                role
            }
        });

        // remover senha antes de enviar resposta
        const { password: _, ...userWithoutPassword } = user;

        res.status(201).json(userWithoutPassword);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});


router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // validação básica
        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        // buscar usuário
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(400).json({ error: 'Usuário não encontrado' });
        }

        // comparar senha
        const isValid = await bcrypt.compare(password.toString(), user.password);

        if (!isValid) {
            return res.status(400).json({ error: 'Senha inválida' });
        }

        // gerar token
        const token = jwt.sign(
            {
                id: user.id,
                role: user.role
            },
            process.env.JWT_SECRET
        );

        // remover senha da resposta
        const { password: _, ...userWithoutPassword } = user;

        // resposta
        res.json({
            token,
            user: userWithoutPassword
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no login' });
    }
});

export default router;