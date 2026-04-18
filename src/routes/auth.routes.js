import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';

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

export default router;