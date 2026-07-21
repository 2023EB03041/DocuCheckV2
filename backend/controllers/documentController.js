import IdDocument from '../models/IdDocument.js';

class DocumentController {
  async getDocument(req, res) {
    try {
      const document = await IdDocument.findById(req.params.id);
      
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      res.set('Content-Type', document.contentType);
      res.send(document.data);
    } catch (error) {
      console.error('Document fetch error:', error);
      res.status(500).json({ message: 'Internal server error fetching document' });
    }
  }
}

export default new DocumentController();
